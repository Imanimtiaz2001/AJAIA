import { rm } from 'node:fs/promises';
import { loadConfig } from '../server/config';

/** Deletes the embedded development database; it is recreated and re-seeded on next start. */
const config = loadConfig();
if (config.databaseUrl) {
  console.error('DATABASE_URL is set; refusing to touch a remote database. Unset it to reset the local PGlite store.');
  process.exit(1);
}
await rm(config.pgliteDir, { recursive: true, force: true });
console.log(`Removed ${config.pgliteDir}. Demo data will be re-seeded on next start.`);
