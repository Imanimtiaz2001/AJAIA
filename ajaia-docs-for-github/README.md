# Ajaia Docs

A lightweight collaborative document editor: create and format documents in the browser, import files, and share them with teammates as **viewer** or **editor**.

- **Live app:** https://ajaia-docs-iman.vercel.app
- **Walkthrough video:** https://drive.google.com/file/d/1hbgbRsiABNwe7lyv_r1lIzh3ozbmBzcy/view?usp=sharing
- **Architecture note:** [`ARCHITECTURE.md`](ARCHITECTURE.md) · **AI workflow note:** [`AI_WORKFLOW.md`](AI_WORKFLOW.md) · **Submission index:** [`SUBMISSION.md`](SUBMISSION.md)

## Demo accounts

All seeded accounts use the password **`demo1234`**. The login page also has one-click buttons for each account.

| Account | Email              | Seeded data                                                        |
| ------- | ------------------ | ------------------------------------------------------------------ |
| Alice   | `alice@ajaia.test` | Owns “Q3 Product Planning” (shared with Bob as **editor**)         |
| Bob     | `bob@ajaia.test`   | Owns “Team Onboarding Checklist” (shared with Alice as **viewer**) |
| Carol   | `carol@ajaia.test` | Owns a private document; nothing shared with her yet               |

**Quick sharing test:** sign in as Alice in one window and as Bob in a private/incognito window. Open “Q3 Product Planning” in both. Edit as Bob; Alice’s open editor updates within a few seconds.

## What works end to end

| Area                | What you can do                                                                                                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documents           | Create, rename (click the title), edit, delete (owner only), reopen. Autosave about 1 s after you stop typing, `Ctrl/⌘+S` saves at once.                                                                                                                              |
| Rich text           | Bold, italic, underline, strikethrough, Heading 1–3, bulleted and numbered lists, quotes, links, undo/redo, clear formatting. Standard shortcuts work.                                                                                                                |
| File import         | **Import file** on the documents page turns a file into a new document. **Insert file** in the editor toolbar inserts a file at the cursor of the current draft.                                                                                                      |
| Sharing             | The owner shares by email as **Can view** or **Can edit**, changes a role, or removes access. Lists are split into **Owned by me** and **Shared with me**, with owner and role badges.                                                                                |
| Access control      | Enforced on the server for every request. Viewers get a read-only editor; editors cannot share or delete; people without access get a 404.                                                                                                                            |
| Collaboration       | Every save is versioned. If two people save the same version, the second gets a conflict banner (“Load their version” / “Keep my changes”) instead of silently overwriting. Open documents pick up other people’s saves automatically (polling every 4 s while idle). |
| Persistence         | Postgres (Neon in production). Content is stored as structured editor JSON, so all formatting survives refresh and reopen.                                                                                                                                            |
| Validation & errors | Server-side validation (zod + editor-schema validation), friendly error messages, offline retry for autosave, unsaved-changes warning on tab close.                                                                                                                   |

### Supported import file types

| Type       | Extensions         | Kept                                                      |
| ---------- | ------------------ | --------------------------------------------------------- |
| Word       | `.docx`            | Headings, bold/italic/underline, lists, links, paragraphs |
| Markdown   | `.md`, `.markdown` | Headings, emphasis, lists, quotes, code, links            |
| Plain text | `.txt` (UTF-8)     | Paragraphs (blank-line separated) and line breaks         |

Limit: **2 MB per file**. Images, tables and page layout are not imported. Legacy `.doc`, PDF and other types are rejected with a clear message. Sample files to try are in [`sample-files/`](sample-files).

## Run locally

Requirements: **Node.js 22** and npm. No database install is needed.

```bash
npm install
npm run dev
```

Open **http://localhost:5173** and use a demo account.

- `npm run dev` starts the API on port 4000 and the Vite dev server on port 5173 (it proxies `/api`).
- Without `DATABASE_URL`, the app uses **PGlite** (real Postgres compiled to WebAssembly), stored in `./.data/pglite`. Tables and demo data are created on first start.
- To use your own Postgres instead, copy `.env.example` to `.env` and set `DATABASE_URL`.
- `npm run db:reset` deletes the local database; it is re-seeded on next start.

Production-like run (one process serves the API and the built UI):

```bash
npm run build
npm start          # http://localhost:4000
```

## Tests and checks

```bash
npm test             # 35 API integration + unit tests (in-memory Postgres via PGlite)
npm run test:e2e     # browser test of the main journey (Playwright + Chromium)
npm run typecheck    # TypeScript strict mode
npm run check        # typecheck + formatting + tests
```

`npm run test:e2e` needs a Chromium: run `npx playwright install chromium` once, or set `CHROME_PATH` to an installed Chrome.

What the tests cover: sign-in, cookie flags, CSRF header, logout invalidation; create/rename/edit/reopen with formatting; schema and link validation; title limits; version conflicts (409); owner-only delete; owned vs shared lists; viewer/editor/owner permissions; revoking access; share validation; `.md`, `.txt` and real `.docx` import; rejection of unsupported, disguised, empty, oversized and non-UTF-8 files; and a two-user browser journey.

## Configuration

| Variable            | Default          | Purpose                                                           |
| ------------------- | ---------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`      | unset → PGlite   | Postgres connection string (required on Vercel)                   |
| `PORT`              | `4000`           | API port for `npm run dev` / `npm start`                          |
| `DEMO_PASSWORD`     | `demo1234`       | Password for seeded accounts, applied when the DB is first seeded |
| `SESSION_TTL_HOURS` | `168`            | Session lifetime                                                  |
| `SECURE_COOKIES`    | `true` on Vercel | HTTPS-only `__Host-` session cookie                               |

## Deployment (Vercel + Neon)

The live app runs on Vercel’s free tier with a free Neon Postgres database.

1. Import the GitHub repository in Vercel. `vercel.json` sets the install and build commands, so no framework settings are needed.
2. Add a Neon database (Vercel → Storage → Neon, or create one at neon.tech) and set `DATABASE_URL` for the project.
3. Deploy. On the first request the API runs migrations and seeds the demo accounts.

`npm run build:vercel` produces a [Build Output API](https://vercel.com/docs/build-output-api/v3) bundle: the SPA as static files on Vercel’s CDN and the Express API bundled with esbuild into one Node 22 function at `/api/*`.

## Project structure

```
server/                 Express API (TypeScript)
  app.ts                composition root: repositories → services → routes
  config.ts             validated environment config
  db/                   database port (Postgres | PGlite), migrations, seed data
  middleware/           session auth, CSRF header check, rate limit, error handler
  modules/
    auth/               login, logout, session lookup
    documents/          repository (SQL), service (rules), routes, content validation, access guard
    sharing/            share repository, service, routes
    imports/            file → document converters (.docx, .md, .txt)
    users/              user directory for the share dialog
  vercel.ts             serverless entry point
shared/                 code used by both client and server
  editor.ts             TipTap extension list = the single document schema
  permissions.ts        role → action policy
  limits.ts, types.ts   limits, supported file types, API types
src/                    React web client (Vite)
  api/                  typed fetch client
  hooks/useDocumentSync debounced autosave + optimistic concurrency
  pages/, components/   screens, toolbar, share dialog, modals, toasts
tests/                  Vitest API/unit tests, e2e/ browser test, fixtures
scripts/                Vercel build, local DB reset
sample-files/           .docx, .md and .txt files to try the importer
```

## Scope decisions

**Deliberately not built** (to keep depth in the core flows):

- Real-time co-editing (CRDT/OT, live cursors). Replaced by versioned saves, conflict detection and 4-second polling, which is honest about concurrency without the complexity.
- Sign-up, password reset, email invitations. Seeded accounts with a real session-based login cover the sharing review; sharing with an email that has no account returns a clear error.
- Images and tables in documents, comments/suggestions, version history UI, export.
- Server-side search and pagination of the document list (the list query is capped at 500 rows).

**Next 2–4 hours, in order:**

1. Version history: keep a snapshot per save (the `version` column already exists) and add a restore view.
2. Export to Markdown/PDF from the editor.
3. Presence indicators (“Bob is viewing”) using the existing polling endpoint, then move change notifications to server-sent events.
4. Rate limiting backed by Postgres or Redis (the current limiter is per serverless instance).
