import { Link } from "@/i18n/navigation";
import { CreateBookForm } from "./create-book-form";

export default function NewBookPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Add book</h1>
        <p className="mt-1 text-sm text-muted">
          <Link href="/books/new/auto" className="text-accent underline">
            Auto-Gen Book
          </Link>
          {" — "}
          full TOC and chapter drafts in one guided flow (WebGPU).
        </p>
        <p className="mt-1 text-sm text-muted">
          One book focuses on one historical figure. Add sections from the book
          page or split content with Markdown headings for now.
        </p>
      </div>
      <CreateBookForm />
      <p className="text-sm text-muted">
        <Link href="/">← Back to browse</Link>
      </p>
    </div>
  );
}
