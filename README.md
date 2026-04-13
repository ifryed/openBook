# OpenBook

OpenBook is a small **wiki-style biography app**: each *book* is about one historical figure, split into **sections** (chapters) with **full revision history** (like Wikipedia). Sign in to create books, edit Markdown, browse history and diffs, and use **optional local AI** in the browser (WebLLM) for table-of-contents ideas and chapter drafts. Server-side helpers can pull short snippets from **Wikipedia**, **Wikidata**, **Open Library**, and **Grokipedia** for drafts and figure-name verification.

## Stack

- [Next.js](https://nextjs.org/) 15 (App Router), React 19, TypeScript  
- [Prisma](https://www.prisma.io/) + **PostgreSQL**  
- [Auth.js](https://authjs.dev/) (NextAuth v5) — email/password and optional Google  
- [WebLLM](https://webllm.mlc.ai/) — in-browser Llama 3.1 8B for TOC / chapter drafting (WebGPU)

## Prerequisites

- Node.js 20+ recommended  
- Docker (optional) for local PostgreSQL, or any Postgres instance  
- A modern **Chrome or Edge** on desktop if you use WebLLM (WebGPU)

## Quick start

1. **Clone and install**

   ```bash
   git clone https://github.com/ifryed/openBook.git
   cd openBook
   npm install
   ```

2. **Environment**

   ```bash
   cp .env.example .env
   ```

   Set at least `DATABASE_URL` and `AUTH_SECRET` (`openssl rand -base64 32`). See `.env.example` for Google OAuth and optional `REFERENCE_LOOKUP_USER_AGENT` ([Wikimedia User-Agent policy](https://meta.wikimedia.org/wiki/User-Agent_policy)).

3. **Database**

   Start Postgres (example using this repo’s Compose file):

   ```bash
   npm run db:up
   ```

   Apply migrations:

   ```bash
   npm run db:migrate
   ```

   Or use `npm run db:setup` if you prefer the helper script.

4. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run db:up` / `db:down` | Docker Compose Postgres |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:push` | `prisma db push` (prototyping) |
| `npm run db:setup` | Shell helper for DB + migrate |

## Features (short)

- **Books** — title, figure name, intended audience (ages), summary, tags, URL slug; **edit book** metadata from the book page.  
- **Sections** — per-section Markdown, **revisions**, history, diff, revert.  
- **Figure name** — “Check name” loads Wikipedia + Wikidata matches; you **pick and confirm** a person before create/save (server re-validates).  
- **Local AI** — optional WebLLM on the book page (TOC suggestions) and section edit page (chapter draft with whole-book context and optional reference snippets).  
- **Reference snippets** — server fetches public API/HTML snippets (Wikipedia, Wikidata, Open Library, Grokipedia) for draft prompts; not a substitute for fact-checking.

## Production notes

- Set `AUTH_SECRET`, use a strong `DATABASE_URL`, and configure `AUTH_TRUST_HOST` / OAuth redirect URLs for your domain.  
- WebLLM runs **in the user’s browser**; first model load can be large.  
- Rate limits apply to book creation and revisions (see `src/lib/rate-limit.ts`).

## License

This project is provided as-is for your own use; add a `LICENSE` file if you want to publish under a specific license.
