# Architecture note

## Goal and priorities

The brief asks for a working slice of a Google Docs–style editor in a short timebox. I prioritised, in order:

1. **A reliable editing loop**: create → edit with rich text → autosave → reopen with formatting intact.
2. **Correct access control**: an owner, two share roles, and server-side enforcement on every request.
3. **Honest collaboration semantics**: two people editing the same document must never silently overwrite each other.
4. **A deployment reviewers can use immediately**: seeded accounts, one-click sign-in, no setup.

Everything else (real-time co-editing, sign-up, images, export) was cut on purpose and is listed in the README.

## System overview

```
Browser (React + TipTap)                    Vercel
┌──────────────────────────┐   HTTPS   ┌──────────────────────────────────────────┐
│ Pages: login, list,      │──────────▶│ CDN: built SPA (static files)            │
│ editor, share dialog     │           │                                          │
│ useDocumentSync:         │  /api/*   │ Node 22 function: Express API            │
│  debounce → PATCH with   │──────────▶│  middleware: helmet, session, CSRF hdr   │
│  baseVersion, 409 →      │           │  routes → services → repositories        │
│  conflict banner         │           │  content validator (shared schema)       │
└──────────────────────────┘           └──────────────────┬───────────────────────┘
                                                          │ SQL (pg)
                                                   ┌──────▼──────┐
                                                   │ Neon Postgres│
                                                   └─────────────┘
```

Local development and tests run the same Express app against **PGlite** (Postgres compiled to WebAssembly), so there is one SQL dialect everywhere and reviewers need no database install.

## Stack choices

| Choice                                | Why                                                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TipTap 3 (ProseMirror)**            | Mature schema-based editor. Documents are structured JSON, not HTML strings, which makes validation and safe rendering straightforward.                          |
| **React 19 + Vite + TanStack Query**  | Fast build, code-split editor bundle (TipTap loads only when a document opens), simple server-state caching.                                                     |
| **Express 5 + zod**                   | Small, well-known API layer. Express 5 forwards async errors to one error handler.                                                                               |
| **Postgres (Neon) + PGlite**          | Relational data (users, documents, shares) with real constraints. Serverless file systems are ephemeral, so SQLite on disk was ruled out for the hosted version. |
| **Raw parameterised SQL**             | Four tables. Readable queries with no ORM layer to learn; every query is parameterised.                                                                          |
| **Vercel Build Output API + esbuild** | The API is bundled into one function file and the SPA goes to the CDN. Deterministic: the deployed server is the same code that runs locally and in tests.       |

## Code structure and principles

- **Layering:** `routes` (HTTP and input parsing) → `services` (business rules) → `repositories` (SQL). Routes contain no SQL; repositories contain no HTTP.
- **Composition root:** `server/app.ts` wires everything with constructor injection. Tests pass in an in-memory database; production passes Neon. Nothing reads globals.
- **Single sources of truth (DRY):**
  - `shared/editor.ts` defines the editor extensions. The browser editor, the server validator and the importers all build their schema from it.
  - `shared/permissions.ts` defines the role → action policy. The API enforces it through one guard (`DocumentAccess.require`); the UI uses the same table only to hide controls.
  - `shared/limits.ts` defines file types and size limits shown in the UI and enforced by the API.
- **Open/closed importers:** each file type is a small converter (`toHtml`). Adding a format means adding one entry; the sanitising and schema validation pipeline stays the same.
- **Database port:** repositories depend on a small `Database` interface (`query`, `exec`, `transaction`), so Postgres and PGlite are interchangeable.

## Data model

```
users            (id, email unique lower(), name, password_hash)
sessions         (token_hash PK, user_id → users, expires_at)
documents        (id, owner_id → users, title, content JSONB, content_text, version, updated_at, updated_by)
document_shares  (document_id → documents, user_id → users, role 'viewer'|'editor', PK(document_id, user_id))
```

- Ownership is a column, not a share row, so a document always has exactly one owner.
- `content` is ProseMirror JSON; `content_text` is a plain-text projection for list previews.
- Deleting a document cascades to its shares. Migrations are forward-only and run on boot under an advisory lock, so concurrent serverless cold starts cannot race.

## Access control

- Every document query is scoped to the caller and resolves their role in SQL (`owner` via `owner_id`, otherwise the share row).
- No access → **404**, so ids cannot be probed. Wrong role → **403** with a specific message.
- Policy: owner = read, edit, share, delete. Editor = read, edit (including rename). Viewer = read.
- Anyone with access can see who else has access; only the owner can change it.

## Saving and concurrency

- The client debounces edits (800 ms) and sends at most one request at a time.
- Each `PATCH` carries `baseVersion`. The update is `UPDATE … WHERE id = $1 AND version = $2`, which increments `version`. If no row matches, the API returns **409** with the latest document.
- The client then shows a conflict banner: **Load their version** (discard local changes) or **Keep my changes** (save my version as the new latest, deliberately). Only changed fields are sent, so keeping your content does not undo someone else’s rename.
- When there are no unsaved changes, an open document polls every 4 seconds and applies newer versions in place (keeping the caret), which also covers viewers and revoked access.
- Network or 5xx failures keep changes queued and retry; the tab warns before closing with unsaved changes.

This is not real-time co-editing; it is a deliberate, smaller design that never loses work. A CRDT (for example Yjs) is the natural next step if simultaneous typing in the same paragraph matters.

## File import pipeline

`upload (multer, memory only, 2 MB)` → `extension allow-list + checks` (ZIP signature for .docx, strict UTF-8 for text, non-empty) → `converter → HTML` (mammoth / marked / escaped text) → `sanitize-html allow-list` (no scripts, styles, images, event handlers; h4–h6 become h3) → `TipTap schema parse` → `same validator as normal saves` → new document (or returned for insertion into the current draft). The title comes from the first top-level heading, falling back to the file name. Files are never written to disk.

## Security

- **Sessions:** 256-bit random tokens; only the SHA-256 hash is stored. Cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` with the `__Host-` prefix in production. Logout deletes the session row.
- **Passwords:** scrypt with per-user salt; constant-time comparison; unknown emails take the same path as wrong passwords.
- **CSRF:** SameSite cookie plus a required custom request header on every state-changing request.
- **XSS:** content is schema-validated JSON rendered by ProseMirror, never injected as HTML. Links must be `http`, `https` or `mailto`. Imports are sanitised before parsing. A strict Content-Security-Policy is set on the SPA.
- **Other:** helmet headers, login rate limiting, request size limits, `Cache-Control: no-store` on API responses, generic 500 messages (details only in server logs).

## Testing strategy

- **API integration tests (Vitest + supertest)** run the real Express app on an in-memory Postgres (PGlite) per test file: auth, documents, sharing/permissions, conflicts and imports, including a real `.docx` fixture.
- **Unit tests** for the permission policy and text projection.
- **Browser e2e (Playwright)**: two users, create → format → autosave → reload → share → collaborator edits → owner sees the change live; view-only rendering.
- The production bundle was also run against a local Postgres 16 server before deploying, to exercise the `pg` code path.

## Known limitations

- Polling, not push: changes appear within about 4 seconds, and simultaneous edits resolve through the conflict banner rather than merging.
- The login rate limiter is in-memory, so on serverless it is per instance.
- The share dialog lists every account, which suits an internal tool with a small directory but not a large organisation.
- No pagination on the document list (capped at 500 rows).
