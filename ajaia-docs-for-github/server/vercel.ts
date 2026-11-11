import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { createApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db';

/**
 * Serverless entry point (bundled to .vercel/output by scripts/build-vercel.mjs).
 * The app, its connection pool and the one-time migrations are created on the
 * first request of each instance and reused for warm invocations.
 */
let appPromise: Promise<Express> | undefined;

async function bootstrap(): Promise<Express> {
  const config = loadConfig();
  if (!config.databaseUrl) throw new Error('DATABASE_URL must be set in production.');
  const db = await openDatabase(config);
  return createApp({ config, db });
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  appPromise ??= bootstrap().catch((error: unknown) => {
    appPromise = undefined; // allow the next request to retry a failed cold start
    throw error;
  });

  try {
    const app = await appPromise;
    app(req as Parameters<Express>[0], res as Parameters<Express>[1]);
  } catch (error) {
    console.error('Cold start failed', error);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'INTERNAL', message: 'Service is starting up. Please retry.' } }));
  }
}
