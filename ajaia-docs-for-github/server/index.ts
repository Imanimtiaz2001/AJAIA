import { loadConfig } from './config';
import { createApp } from './app';
import { openDatabase } from './db';

/** Long-running server for local development and `npm start`. */
async function main(): Promise<void> {
  const config = loadConfig();
  const db = await openDatabase(config);
  // Serves the built SPA when present (`npm start`); during `npm run dev` Vite serves the UI instead.
  const app = createApp({ config, db, clientDir: 'dist/client' });

  const server = app.listen(config.port, () => {
    const storage = config.databaseUrl ? 'Postgres (DATABASE_URL)' : `embedded PGlite at ${config.pgliteDir}`;
    console.log(`Ajaia Docs API listening on http://localhost:${config.port} using ${storage}`);
  });

  const shutdown = () => {
    server.close(() => {
      void db.close().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
