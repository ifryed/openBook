# openbook-offline-catalog

Read **OpenBook** public catalog snapshots on your own computer. The live site can export all published books as one JSON file; this folder contains a small **browser viewer** (no Node or database).

## What you get from the site

The endpoint **`/api/site/public-catalog.json`** (no locale prefix) returns version `1` JSON: each published book with slugs, figure name, tags, supported locales, titles per locale, summaries, and chapter Markdown bodies only where a chapter is “complete” in that language (same rules as the public reader). Drafts, revision history, and accounts are **not** included.

Content remains under the **Creative Commons** terms shown in the site footer—this export is for personal backup and offline reading, not for stripping attribution or bypassing the license.

## Download the snapshot

1. Open the site in a browser (local dev: `http://localhost:3000`, production: your deployed origin).
2. Use **Offline catalog** in the header (or go to `/en/offline-catalog` and adjust the locale prefix), then follow the **public-catalog.json** link; or visit directly:  
   `https://<your-host>/api/site/public-catalog.json`  
   Save the file (browser “Save as…” or command line below).

From a terminal:

```bash
curl -fsSL -o openbook-public-catalog.json 'https://example.com/api/site/public-catalog.json'
```

Replace `https://example.com` with your real origin.

## Run the viewer locally

1. Clone this repository (or copy only the folder `tools/openbook-offline-catalog/`).
2. Open **`viewer/index.html`** in a desktop browser (double-click, or “Open file…”).
3. Click **Load catalog…** and choose the `.json` file you downloaded.
4. Pick a **book**, a **language** (if the book has several), then a **chapter** from the list.

### Markdown rendering and the network

The viewer loads **[marked](https://github.com/markedjs/marked)** from **esm.sh** so chapter Markdown renders as HTML (similar to the site). That needs a **one-time internet connection** when you first open the page (or when the browser cache is cold).

If you are fully air-gapped, the viewer falls back to showing the raw Markdown in a `<pre>` block when the script cannot load. For nicer offline rendering later, you could vendor a copy of `marked` next to `index.html` and change the import path in the source.

## Run the full OpenBook app locally

The JSON snapshot is **not** a database dump. To run the real Next.js app with Postgres, auth, and editing, see the repository root **[README.md](../../README.md)** (`npm install`, `.env`, `npm run db:migrate`, `npm run dev`).
