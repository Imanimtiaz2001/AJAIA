import { randomUUID } from 'node:crypto';
import { hashPassword } from '../lib/crypto';
import { htmlToContent } from '../modules/documents/content';
import type { Database } from './database';

export const DEMO_USERS = [
  { email: 'alice@ajaia.test', name: 'Alice Khan' },
  { email: 'bob@ajaia.test', name: 'Bob Mirza' },
  { email: 'carol@ajaia.test', name: 'Carol Ahmed' },
] as const;

type DemoEmail = (typeof DEMO_USERS)[number]['email'];

interface SeedDocument {
  owner: DemoEmail;
  title: string;
  html: string;
  shares: { with: DemoEmail; role: 'viewer' | 'editor' }[];
}

const SEED_DOCUMENTS: SeedDocument[] = [
  {
    owner: 'alice@ajaia.test',
    title: 'Q3 Product Planning',
    html: `
      <h1>Q3 Product Planning</h1>
      <p>This doc captures the <strong>priorities</strong>, <em>open questions</em> and <u>owners</u> for next quarter.</p>
      <h2>Priorities</h2>
      <ol><li>Ship the shared workspace beta</li><li>Cut onboarding time in half</li><li>Instrument activation metrics</li></ol>
      <h2>Open questions</h2>
      <ul><li>Do we need offline support for the beta?</li><li>Who signs off on pricing changes?</li></ul>
      <blockquote>Bob has edit access to this doc. Open it as Bob in a second window: his saved edits show up here within a few seconds.</blockquote>`,
    shares: [{ with: 'bob@ajaia.test', role: 'editor' }],
  },
  {
    owner: 'bob@ajaia.test',
    title: 'Team Onboarding Checklist',
    html: `
      <h1>Team Onboarding Checklist</h1>
      <p>Everything a new teammate needs in their first week.</p>
      <h2>Day one</h2>
      <ul><li>Laptop and accounts</li><li>Meet your onboarding buddy</li><li>Read the engineering handbook</li></ul>
      <h2>First week</h2>
      <ul><li>Ship a small change to production</li><li>Join the support rotation as a shadow</li></ul>
      <p>Alice has <strong>view-only</strong> access to this doc.</p>`,
    shares: [{ with: 'alice@ajaia.test', role: 'viewer' }],
  },
  {
    owner: 'carol@ajaia.test',
    title: 'Customer Interview Notes',
    html: `
      <h1>Customer Interview Notes</h1>
      <p>Private notes. Nobody else has access until Carol shares this document.</p>
      <h3>Themes</h3>
      <ul><li>Search across documents is the top request</li><li>People want to share with a whole team at once</li></ul>`,
    shares: [],
  },
];

/** Seeds demo users and documents into an empty database. Idempotent. */
export async function seedDemoData(db: Database, demoPassword: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [{ count } = { count: 0 }] = await tx.query<{ count: number }>('SELECT count(*)::int AS count FROM users');
    if (count > 0) return;

    const passwordHash = await hashPassword(demoPassword);
    const ids = new Map<DemoEmail, string>();
    for (const user of DEMO_USERS) {
      const id = randomUUID();
      ids.set(user.email, id);
      await tx.query('INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)', [
        id,
        user.email,
        user.name,
        passwordHash,
      ]);
    }

    for (const doc of SEED_DOCUMENTS) {
      const ownerId = ids.get(doc.owner)!;
      const documentId = randomUUID();
      const { content, text } = htmlToContent(doc.html);
      await tx.query(
        `INSERT INTO documents (id, owner_id, title, content, content_text, updated_by)
         VALUES ($1, $2, $3, $4::jsonb, $5, $2)`,
        [documentId, ownerId, doc.title, JSON.stringify(content), text],
      );
      for (const share of doc.shares) {
        await tx.query('INSERT INTO document_shares (document_id, user_id, role, granted_by) VALUES ($1, $2, $3, $4)', [
          documentId,
          ids.get(share.with)!,
          share.role,
          ownerId,
        ]);
      }
    }
  });
}
