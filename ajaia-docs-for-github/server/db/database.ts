/**
 * Minimal database port. Repositories depend on this interface only, so the
 * same SQL runs against Neon/Postgres in production and embedded PGlite
 * (real Postgres compiled to WASM) for local development and tests.
 */
export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  /** Runs a multi-statement script without parameters (migrations). */
  exec(sql: string): Promise<void>;
}

export interface Database extends Queryable {
  transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function createPostgresDatabase(connectionString: string): Promise<Database> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString,
    // Serverless functions run many small instances; keep each pool small.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  return {
    async query<T>(sql: string, params: readonly unknown[] = []) {
      const result = await pool.query(sql, params as unknown[]);
      return result.rows as T[];
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async transaction<T>(work: (tx: Queryable) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx: Queryable = {
          query: async <R>(sql: string, params: readonly unknown[] = []) =>
            (await client.query(sql, params as unknown[])).rows as R[],
          exec: async (sql: string) => {
            await client.query(sql);
          },
        };
        const result = await work(tx);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/** `dataDir` undefined means an in-memory database (used by tests). */
export async function createPgliteDatabase(dataDir?: string): Promise<Database> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir) {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(dataDir, { recursive: true });
  }
  const db = new PGlite(dataDir);
  await db.waitReady;

  // PGlite is a single connection; serialise transactions so concurrent
  // requests in the dev server never interleave statements inside one.
  let queue: Promise<unknown> = Promise.resolve();

  return {
    async query<T>(sql: string, params: readonly unknown[] = []) {
      await queue;
      const result = await db.query<T>(sql, params as unknown[]);
      return result.rows;
    },
    async exec(sql: string) {
      await queue;
      await db.exec(sql);
    },
    transaction<T>(work: (tx: Queryable) => Promise<T>) {
      const run = queue.then(() =>
        db.transaction(async (trx) =>
          work({
            query: async <R>(sql: string, params: readonly unknown[] = []) =>
              (await trx.query<R>(sql, params as unknown[])).rows,
            exec: async (sql: string) => {
              await trx.exec(sql);
            },
          }),
        ),
      );
      queue = run.catch(() => undefined);
      return run;
    },
    close: () => db.close(),
  };
}
