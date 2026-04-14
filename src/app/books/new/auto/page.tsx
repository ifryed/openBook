import Link from "next/link";
import { AutoBookWizard } from "@/components/auto-book-wizard";

export default function NewAutoBookPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Auto book (local AI)</h1>
        <p className="mt-1 text-sm text-muted">
          Create a book, generate a table of contents with WebLLM in your browser,
          then draft each chapter in order. You can watch each step below. The
          model runs locally via WebGPU; the first run may download a large model
          to your browser cache.
        </p>
      </div>
      <AutoBookWizard />
      <p className="text-sm text-muted">
        <Link href="/books/new">← Manual new book</Link>
        {" · "}
        <Link href="/">Browse</Link>
      </p>
    </div>
  );
}
