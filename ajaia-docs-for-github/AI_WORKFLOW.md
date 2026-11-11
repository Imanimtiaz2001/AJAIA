# AI workflow note

## Tools I used

- **Claude Code (Claude)** as my main coding assistant in the terminal: scaffolding, drafting modules and tests, running the test suite, and driving a headless browser for UI checks.
- **Playwright** (scripted by me with the assistant) to click through the app as two users at once and capture screenshots for review.

I owned the decisions: scope, architecture, data model, access rules and what “done” means. The assistant produced drafts quickly; I reviewed, ran and corrected them.

## Where AI materially sped things up

- **Boilerplate with a clear spec.** Express routers, zod schemas, repository SQL and typed API client functions followed patterns I defined once, then generated quickly.
- **Test breadth.** After I listed the cases that matter (roles, 409 conflicts, disguised files, revoked access), the assistant wrote most of the 35 integration tests and the e2e journey in minutes.
- **Library details.** TipTap 3 APIs (`useEditorState`, server-side `generateJSON`), Vercel’s Build Output API format, and mammoth/marked options.
- **CSS and UI polish.** First drafts of the layout and component styles, which I then adjusted after looking at screenshots.

## What I changed or rejected

| AI output                                                            | What I did and why                                                                                                                                                                                  |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autosave as “last write wins”                                        | **Rejected.** Added a `version` column, `baseVersion` on every save, 409 on mismatch and a conflict banner. Silent overwrites are the worst failure for a shared editor.                            |
| Storing editor HTML and rendering it back                            | **Rejected.** Content is stored as ProseMirror JSON and validated server-side against the same schema the editor uses. HTML only exists briefly inside the importer, after an allow-list sanitiser. |
| SQLite file database                                                 | **Rejected for hosting.** Vercel’s file system is ephemeral, so data would vanish. Chose Neon Postgres in production and PGlite locally, keeping one SQL dialect and zero local setup.              |
| `queryClient.clear()` on login                                       | **Fixed.** A browser run showed sign-in bouncing back to the login page because the auth query lost its data. Replaced with removing only user-scoped queries.                                      |
| Importing `generateJSON` from `@tiptap/html` on the server           | **Fixed.** It threw “browser environment only” at runtime; switched to `@tiptap/html/server`, and added a quick conversion check before building on it.                                             |
| Latest TypeScript (7.x) picked by default                            | **Pinned to 5.9.** The native compiler is new and other tooling still expects the JS compiler API. Dependencies are pinned to exact versions for reproducible deploys.                              |
| `Secure` cookie whenever `NODE_ENV=production`                       | **Changed.** It broke `npm start` over plain `http://localhost`. Secure `__Host-` cookies are now on when running on Vercel (or via `SECURE_COOKIES`).                                              |
| Conflict banner placed in the page flow                              | **Changed** after reviewing a screenshot: once the page scrolls, the banner was off-screen. Toolbar and banners now share one sticky container.                                                     |
| Imported document titled from the file name (`quarterly-review`)     | **Changed** to use the document’s first top-level heading, falling back to a tidied file name.                                                                                                      |
| An order-dependent test (`toEqual` on a shared list)                 | **Fixed** to `toContainEqual`; tests must not depend on execution order.                                                                                                                            |
| Test `.docx` fixtures generated with python-docx (37 KB each)        | **Replaced** with a minimal hand-built `.docx` (2 KB) that still exercises headings, emphasis and both list types.                                                                                  |
| Suggestions to add real-time CRDT editing, sign-up and email invites | **Deferred.** Out of proportion for the timebox; documented as next steps instead.                                                                                                                  |

## How I verified correctness, UX and reliability

- **Automated tests:** `npm test` (35 tests: auth, permissions, conflicts, imports and validation) on a real Postgres engine (PGlite), plus a Playwright e2e test of the full two-user journey. `npm run check` also runs strict TypeScript and Prettier.
- **Real database path:** ran the bundled production function against a local Postgres 16 server and checked login, import and a forced 409 conflict with curl before deploying.
- **Two-user manual runs:** scripted Alice and Bob in separate browser contexts: share, edit, see live updates, force a simultaneous-save conflict, open a view-only document.
- **Visual review:** screenshots of every screen at desktop width, checked for layout, states (saving, offline, conflict, view-only) and copy.
- **Security review:** read every query for parameterisation and user scoping; checked cookies, CSRF header, CSP and the import sanitiser; added tests for `javascript:` links, schema-invalid content and disguised files.
- **Deployed check:** after deploying, repeated the main flows on the live URL with the seeded accounts.
