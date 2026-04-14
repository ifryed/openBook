import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import epub from "epub-gen-memory";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { prisma } from "@/lib/db";

/** Inline styles aligned with `.prose-wiki` in globals.css (no CSS variables). */
export const BOOK_EXPORT_INLINE_CSS = `
body { font-family: system-ui, sans-serif; line-height: 1.65; color: #1a1a1a; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; }
.book-export-header { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #e5e5e5; }
.book-export-header h1 { font-size: 1.75rem; font-weight: 600; margin: 0 0 0.5rem; }
.book-export-meta { color: #555; font-size: 0.95rem; margin: 0.25rem 0; }
.book-export-summary { margin-top: 1rem; }
.prose-wiki { line-height: 1.65; }
.prose-wiki h1, .prose-wiki h2, .prose-wiki h3 { font-weight: 600; margin-top: 1.25em; margin-bottom: 0.5em; }
.prose-wiki p { margin-bottom: 0.75em; }
.prose-wiki ul { list-style: disc; padding-left: 1.5em; margin-bottom: 0.75em; }
.prose-wiki code { font-family: ui-monospace, monospace; font-size: 0.9em; background: #f0eeea; padding: 0.1em 0.35em; border-radius: 4px; }
.prose-wiki pre { background: #f0eeea; padding: 1em; border-radius: 8px; overflow-x: auto; margin-bottom: 0.75em; }
.prose-wiki pre code { background: none; padding: 0; }
main h2 { font-size: 1.35rem; font-weight: 600; margin-top: 2rem; margin-bottom: 0.75rem; }
`;

export function isCalibreExportEnabled(): boolean {
  return Boolean(process.env.CALIBRE_EBOOK_CONVERT?.trim());
}

export function safeExportBasename(slug: string): string {
  const s = slug.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return s.length > 0 ? s : "book";
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function getBookForExport(bookSlug: string) {
  return prisma.book.findUnique({
    where: { slug: bookSlug },
    include: {
      sections: {
        orderBy: { orderIndex: "asc" },
        include: {
          revisions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true },
          },
        },
      },
    },
  });
}

export type BookForExport = NonNullable<Awaited<ReturnType<typeof getBookForExport>>>;

/** Server-safe Markdown → HTML (GFM), aligned with MarkdownBody / react-markdown. */
async function markdownExportToHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown);
  return `<div class="prose-wiki max-w-none">${String(file)}</div>`;
}

async function sectionBodyHtml(
  section: BookForExport["sections"][number],
): Promise<string> {
  const body = section.revisions[0]?.body?.trim() ?? "";
  if (!body) {
    return `<div class="prose-wiki max-w-none"><p><em>No content yet.</em></p></div>`;
  }
  return markdownExportToHtml(body);
}

export async function buildFullHtmlExportDocument(
  book: BookForExport,
): Promise<string> {
  const title = escapeHtml(book.title);
  const figure = escapeHtml(book.figureName);
  const ages = book.intendedAges.trim();
  const summaryHtml = book.summary?.trim()
    ? `<p class="book-export-summary">${escapeHtml(book.summary.trim())}</p>`
    : "";

  const sectionBlocks = (
    await Promise.all(
      book.sections.map(async (s) => {
        const html = await sectionBodyHtml(s);
        return `<h2>${escapeHtml(s.title)}</h2>\n${html}`;
      }),
    )
  ).join("\n\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>${BOOK_EXPORT_INLINE_CSS}</style>
</head>
<body>
<header class="book-export-header">
<h1>${title}</h1>
<p class="book-export-meta">${figure}</p>
${ages ? `<p class="book-export-meta">Age / audience: ${escapeHtml(ages)}</p>` : ""}
${summaryHtml}
</header>
<main>
${sectionBlocks}
</main>
</body>
</html>`;
}

export async function buildEpubBuffer(book: BookForExport): Promise<Buffer> {
  const content = await Promise.all(
    book.sections.map(async (s) => ({
      title: s.title,
      content: await sectionBodyHtml(s),
    })),
  );

  return epub(
    {
      title: book.title,
      author: "OpenBook",
      description:
        book.summary?.trim() ?? `Biography: ${book.figureName}`,
      publisher: "OpenBook",
      lang: "en",
      verbose: false,
      css: BOOK_EXPORT_INLINE_CSS,
    },
    content,
  );
}

const CALIBRE_TIMEOUT_MS = 120_000;

function runEbookConvert(
  calibreBin: string,
  inputPath: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(calibreBin, [inputPath, outputPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ebook-convert timed out"));
    }, CALIBRE_TIMEOUT_MS);
    let stderr = "";
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `ebook-convert exited with ${code}: ${stderr.slice(-2000)}`,
          ),
        );
    });
  });
}

/** EPUB → MOBI or AZW3 via Calibre’s `ebook-convert`. Requires `CALIBRE_EBOOK_CONVERT`. */
export async function convertEpubBufferWithCalibre(
  epubBuffer: Buffer,
  ext: "mobi" | "azw3",
): Promise<Buffer> {
  const calibre = process.env.CALIBRE_EBOOK_CONVERT?.trim();
  if (!calibre) {
    throw new Error("CALIBRE_EBOOK_CONVERT is not set");
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openbook-export-"));
  const epubPath = path.join(dir, "export.epub");
  const outPath = path.join(dir, `export.${ext}`);
  try {
    await fs.writeFile(epubPath, epubBuffer);
    await runEbookConvert(calibre, epubPath, outPath);
    return await fs.readFile(outPath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
