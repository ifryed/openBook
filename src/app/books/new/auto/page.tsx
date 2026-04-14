import Link from "next/link";
import { AutoBookWizard } from "@/components/auto-book-wizard";

export default function NewAutoBookPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Auto book (local AI)</h1>
        <p className="mt-1 text-sm text-muted">
          Run WebLLM in your browser to build a TOC and draft chapters (optional
          AI introduction first). Nothing is saved until you publish. WebGPU
          required; the first run may download a large model to your browser cache.
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
