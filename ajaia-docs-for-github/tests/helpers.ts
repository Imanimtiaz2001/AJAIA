import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../server/app';
import { loadConfig } from '../server/config';
import { openDatabase, type Database } from '../server/db';
import type { DocumentDTO, DocumentSummaryDTO } from '../shared/types';

export const PASSWORD = 'test-password-123';
export const ALICE = 'alice@ajaia.test';
export const BOB = 'bob@ajaia.test';
export const CAROL = 'carol@ajaia.test';

export interface TestContext {
  app: Express;
  db: Database;
}

/** Fresh in-memory Postgres (PGlite), migrated and seeded, per test file. */
export async function createTestContext(): Promise<TestContext> {
  const config = loadConfig({ NODE_ENV: 'test', DEMO_PASSWORD: PASSWORD });
  const db = await openDatabase(config);
  return { app: createApp({ config, db, loginAttemptLimit: 1000 }), db };
}

/** A signed-in client: supertest agent that keeps the session cookie and sends the CSRF header. */
export async function signIn(app: Express, email: string) {
  const agent = request.agent(app);
  agent.set('X-Requested-With', 'test');
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export type Client = Awaited<ReturnType<typeof signIn>>;

export const paragraphDoc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

export async function createDocument(client: Client, title: string): Promise<DocumentDTO> {
  const res = await client.post('/api/documents').send({ title });
  if (res.status !== 201) throw new Error(`Create failed: ${res.status}`);
  return res.body.document as DocumentDTO;
}

export async function listTitles(client: Client, scope: 'all' | 'owned' | 'shared'): Promise<string[]> {
  const res = await client.get(`/api/documents?scope=${scope}`);
  return (res.body.documents as DocumentSummaryDTO[]).map((d) => d.title);
}
