import type { AppConfig } from '../config';
import { createPgliteDatabase, createPostgresDatabase, type Database } from './database';
import { runMigrations } from './migrations';
import { seedDemoData } from './seed';

export type { Database, Queryable } from './database';

/** Opens the configured database, applies migrations and seeds demo data on first boot. */
export async function openDatabase(config: AppConfig): Promise<Database> {
  const db = config.databaseUrl
    ? await createPostgresDatabase(config.databaseUrl)
    : await createPgliteDatabase(config.env === 'test' ? undefined : config.pgliteDir);

  await runMigrations(db);
  await seedDemoData(db, config.demoPassword);
  return db;
}
