import type { Database } from './database';

interface Migration {
  id: number;
  name: string;
  sql: string;
}

/**
 * Forward-only, append-only migrations. Never edit a migration that has shipped;
 * add a new one instead.
 */
const MIGRATIONS: readonly Migration[] = [
  {
    id: 1,
    name: 'initial_schema',
    sql: /* sql */ `
      CREATE TABLE users (
        id            UUID PRIMARY KEY,
        email         TEXT NOT NULL,
        name          TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX sessions_user_idx ON sessions (user_id);
      CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

      CREATE TABLE documents (
        id           UUID PRIMARY KEY,
        owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title        TEXT NOT NULL,
        content      JSONB NOT NULL,
        content_text TEXT NOT NULL DEFAULT '',
        version      INTEGER NOT NULL DEFAULT 1,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_by   UUID REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX documents_owner_updated_idx ON documents (owner_id, updated_at DESC);

      CREATE TABLE document_shares (
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role        TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
        granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (document_id, user_id)
      );
      CREATE INDEX document_shares_user_idx ON document_shares (user_id);
    `,
  },
];

/** Arbitrary constant used to serialise concurrent cold starts. */
const MIGRATION_LOCK_KEY = 482_116_031;

export async function runMigrations(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);
    await tx.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         INTEGER PRIMARY KEY,
        name       TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    const applied = new Set((await tx.query<{ id: number }>('SELECT id FROM schema_migrations')).map((row) => row.id));
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.id)) continue;
      await tx.exec(migration.sql);
      await tx.query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [migration.id, migration.name]);
    }
  });
}
