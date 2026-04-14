import Link from "next/link";

type Props = {
  href: string;
  label: string;
  className?: string;
};

/** Small pencil control for “edit” affordances (contents, chapter, etc.). */
export function EditPencilLink({ href, label, className = "" }: Props) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center justify-center rounded-md border border-transparent p-1.5 text-muted hover:border-border hover:bg-muted/40 hover:text-foreground ${className}`}
      aria-label={label}
      title={label}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4"
        aria-hidden
      >
        <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.419a4 4 0 00-.885 1.343z" />
      </svg>
    </Link>
  );
}
