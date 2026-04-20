"""Mirror openBook vocabularies (intended-audience.ts, book-locales.ts)."""

INTENDED_AUDIENCE_OPTIONS: tuple[str, ...] = (
    "0-3",
    "3-8",
    "5-9",
    "6-10",
    "8-12",
    "teens",
    "young adults",
    "adults",
)

BOOK_LOCALE_OPTIONS: tuple[tuple[str, str], ...] = (
    ("en", "English"),
    ("zh", "Chinese (Mandarin)"),
    ("hi", "Hindi"),
    ("es", "Spanish"),
    ("fr", "French"),
    ("ar", "Arabic"),
    ("he", "Hebrew"),
    ("bn", "Bengali"),
    ("pt", "Portuguese"),
    ("ru", "Russian"),
    ("ur", "Urdu"),
    ("id", "Indonesian"),
    ("de", "German"),
    ("ja", "Japanese"),
    ("sw", "Swahili"),
    ("mr", "Marathi"),
    ("te", "Telugu"),
    ("tr", "Turkish"),
    ("ta", "Tamil"),
    ("vi", "Vietnamese"),
    ("ko", "Korean"),
    ("it", "Italian"),
    ("th", "Thai"),
    ("gu", "Gujarati"),
    ("fa", "Persian (Farsi)"),
    ("pl", "Polish"),
    ("uk", "Ukrainian"),
    ("nl", "Dutch"),
)

BOOK_DRAFT_PAYLOAD_VERSION = 1

# openBook src/lib/book-limits.ts
MAX_AUTO_WIZARD_PUBLISH_SECTIONS = 2001

# openBook src/lib/book-context.ts
MAX_BOOK_CONTEXT_CHARS = 14_000
