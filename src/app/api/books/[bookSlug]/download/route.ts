import type { NextRequest } from "next/server";
import {
  buildEpubBuffer,
  buildFullHtmlExportDocument,
  convertEpubBufferWithCalibre,
  getBookForExport,
  isCalibreExportEnabled,
  safeExportBasename,
} from "@/lib/book-export";
import { resolvePuppeteerExecutablePath } from "@/lib/puppeteer-chrome-path";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

type ExportFormat = "html" | "pdf" | "epub" | "mobi" | "azw3";

function parseFormat(raw: string | null): ExportFormat | null {
  if (
    raw === "html" ||
    raw === "pdf" ||
    raw === "epub" ||
    raw === "mobi" ||
    raw === "azw3"
  ) {
    return raw;
  }
  return null;
}

function attachmentHeaders(
  filename: string,
  contentType: string,
): Record<string, string> {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  const utf8 = encodeURIComponent(filename);
  return {
    ...NO_STORE,
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`,
  };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ bookSlug: string }> },
) {
  const { bookSlug } = await ctx.params;
  const format = parseFormat(req.nextUrl.searchParams.get("format"));
  if (!format) {
    return new Response("Invalid or missing format (html, pdf, epub, mobi, azw3).", {
      status: 400,
      headers: NO_STORE,
    });
  }

  if ((format === "mobi" || format === "azw3") && !isCalibreExportEnabled()) {
    return new Response(
      "MOBI and AZW3 export requires the CALIBRE_EBOOK_CONVERT environment variable (path to Calibre’s ebook-convert binary).",
      { status: 503, headers: NO_STORE },
    );
  }

  const book = await getBookForExport(
    bookSlug,
    req.nextUrl.searchParams.get("lang"),
  );
  if (!book) {
    return new Response("Book not found.", { status: 404, headers: NO_STORE });
  }

  const base = safeExportBasename(book.slug);

  try {
    if (format === "html") {
      const html = await buildFullHtmlExportDocument(book);
      return new Response(html, {
        headers: attachmentHeaders(`${base}.html`, "text/html; charset=utf-8"),
      });
    }

    if (format === "pdf") {
      const html = await buildFullHtmlExportDocument(book);
      const puppeteer = await import("puppeteer");
      const executablePath = resolvePuppeteerExecutablePath(puppeteer);
      const browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "load" });
        const pdf = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
        });
        return new Response(Buffer.from(pdf), {
          headers: attachmentHeaders(`${base}.pdf`, "application/pdf"),
        });
      } finally {
        await browser.close();
      }
    }

    const epubBuf = await buildEpubBuffer(book);

    if (format === "epub") {
      return new Response(new Uint8Array(epubBuf), {
        headers: attachmentHeaders(
          `${base}.epub`,
          "application/epub+zip",
        ),
      });
    }

    const outBuf = await convertEpubBufferWithCalibre(epubBuf, format);
    const mime =
      format === "mobi"
        ? "application/x-mobipocket-ebook"
        : "application/vnd.amazon.ebook";
    return new Response(new Uint8Array(outBuf), {
      headers: attachmentHeaders(`${base}.${format}`, mime),
    });
  } catch (e) {
    console.error("book export failed", e);
    if (format === "pdf" && e instanceof Error) {
      if (
        e.message.startsWith("No Chrome") ||
        e.message.startsWith("PUPPETEER_EXECUTABLE_PATH")
      ) {
        return new Response(e.message, { status: 503, headers: NO_STORE });
      }
    }
    return new Response("Export failed.", { status: 500, headers: NO_STORE });
  }
}
