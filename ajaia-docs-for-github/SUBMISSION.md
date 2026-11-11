# Submission: Ajaia Docs

**Candidate:** Iman Imtiaz
**Assignment:** AI-Native Full Stack Developer — lightweight collaborative document editor

## Links

| What              | Where                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Live product      | https://ajaia-docs-iman.vercel.app                                                                           |
| Walkthrough video | https://drive.google.com/file/d/1hbgbRsiABNwe7lyv_r1lIzh3ozbmBzcy/view?usp=sharing (also in `VIDEO_URL.txt`) |
| Source code       | This folder · GitHub: https://github.com/Imanimtiaz2001/AJAIA                                                |

## Test accounts

Password for all accounts: **`demo1234`** (one-click buttons on the login page).

| Email              | Use it to see                                                    |
| ------------------ | ---------------------------------------------------------------- |
| `alice@ajaia.test` | An owner: “Q3 Product Planning” is shared with Bob as editor     |
| `bob@ajaia.test`   | An editor on Alice’s doc, and owner of a doc Alice can only view |
| `carol@ajaia.test` | A user with no shared documents (try sharing something with her) |

Suggested 3-minute review: sign in as Alice → open “Q3 Product Planning” → format some text → **Share** with `carol@ajaia.test` as **Can view** → sign out → sign in as Carol → **Shared with me** → open it (read-only). Then try **Import file** with a file from `sample-files/`.

## What is included

| Path                                   | Contents                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `README.md`                            | Features, local setup and run instructions, tests, configuration, deployment, scope      |
| `ARCHITECTURE.md`                      | Architecture note: priorities, design, data model, access control, concurrency, security |
| `AI_WORKFLOW.md`                       | AI workflow note: tools, where AI helped, what I changed or rejected, how I verified     |
| `SUBMISSION.md`                        | This file                                                                                |
| `VIDEO_URL.txt`                        | Walkthrough video link                                                                   |
| `docs/screenshots/`                    | Screenshots of each main screen and a short demo GIF                                     |
| `server/`, `shared/`, `src/`           | Source code: Express API, shared schema/policy/types, React client                       |
| `tests/`                               | 35 API/unit tests, browser e2e test, `.docx` fixture                                     |
| `scripts/`                             | Vercel build script, local database reset                                                |
| `sample-files/`                        | `.docx`, `.md` and `.txt` files for trying the importer                                  |
| `package.json`, `package-lock.json`    | Dependencies (exact versions) and scripts                                                |
| `vercel.json`, `.env.example`, configs | Deployment and tool configuration                                                        |

## Requirement checklist

| Requirement                                      | Status | Where                                                                         |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------------- |
| Create, rename, edit, save and reopen documents  | Done   | Documents page, editor title, autosave                                        |
| Bold, italic, underline, headings, lists         | Done   | Editor toolbar and keyboard shortcuts (plus strikethrough, quotes, links)     |
| File upload into the workflow                    | Done   | **Import file** (new document) and **Insert file** (into current draft)       |
| Supported types stated in UI and README          | Done   | Hint under the import button, error messages, README table                    |
| Owner, grant access, owned vs shared distinction | Done   | Share dialog, **Owned by me / Shared with me** tabs, badges                   |
| Persistence of documents, formatting and sharing | Done   | Neon Postgres, JSON content, share table                                      |
| Setup and run instructions                       | Done   | README                                                                        |
| Working deployment                               | Done   | Live product link above                                                       |
| Validation and error handling                    | Done   | zod + schema validation, friendly errors, offline retry                       |
| Meaningful automated tests                       | Done   | `npm test`, `npm run test:e2e`                                                |
| Architecture note and AI workflow note           | Done   | `ARCHITECTURE.md`, `AI_WORKFLOW.md`                                           |
| Walkthrough video                                | Done   | `VIDEO_URL.txt`                                                               |
| Stretch                                          | Done   | Role-based sharing (viewer/editor) and live-update indicator (“Updated by …”) |

## Status

**Working end to end:** sign-in with seeded accounts; document create/rename/edit/delete/reopen; rich-text formatting; autosave with conflict detection; `.docx`/`.md`/`.txt` import as a new document or into an existing draft; sharing with viewer/editor roles, role changes and revoking; owned vs shared lists; read-only view for viewers; automatic pickup of collaborators’ saves; deployed on Vercel with Neon Postgres.

**Intentionally not included:** real-time co-editing (simultaneous typing merges), sign-up and password reset, images and tables, comments, version history UI, export. These were scope cuts, explained in the README and architecture note.

**Next with another 2–4 hours:** version history with restore (the version column already exists), Markdown/PDF export, presence indicators, and a shared rate-limit store.
