import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ALICE,
  BOB,
  createDocument,
  createTestContext,
  paragraphDoc,
  signIn,
  type Client,
  type TestContext,
} from './helpers';

let ctx: TestContext;
let alice: Client;
let bob: Client;

beforeAll(async () => {
  ctx = await createTestContext();
  alice = await signIn(ctx.app, ALICE);
  bob = await signIn(ctx.app, BOB);
});
afterAll(async () => {
  await ctx.db.close();
});

describe('documents', () => {
  it('creates, renames, edits and reopens a document with formatting preserved', async () => {
    const created = await createDocument(alice, 'Launch plan');
    expect(created).toMatchObject({ title: 'Launch plan', version: 1, role: 'owner' });

    const content = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Goals' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Bold' },
            { type: 'text', text: ' and ' },
            { type: 'text', marks: [{ type: 'italic' }, { type: 'underline' }], text: 'styled' },
          ],
        },
        {
          type: 'orderedList',
          attrs: { start: 1, type: null },
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step one' }] }] },
          ],
        },
      ],
    };

    const saved = await alice
      .patch(`/api/documents/${created.id}`)
      .send({ baseVersion: 1, title: 'Launch plan v2', content });
    expect(saved.status).toBe(200);
    expect(saved.body.document.version).toBe(2);

    const reopened = await alice.get(`/api/documents/${created.id}`);
    expect(reopened.body.document.title).toBe('Launch plan v2');
    expect(reopened.body.document.content.content[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
    expect(reopened.body.document.content.content[1].content[2].marks).toEqual([
      { type: 'italic' },
      { type: 'underline' },
    ]);
    expect(reopened.body.document.content.content[2].type).toBe('orderedList');
  });

  it('defaults a blank title to "Untitled document"', async () => {
    const doc = await createDocument(alice, '   ');
    expect(doc.title).toBe('Untitled document');
  });

  it('rejects content that does not match the editor schema', async () => {
    const doc = await createDocument(alice, 'Schema check');
    const res = await alice
      .patch(`/api/documents/${doc.id}`)
      .send({ baseVersion: 1, content: { type: 'doc', content: [{ type: 'iframe' }] } });
    expect(res.status).toBe(400);
  });

  it('rejects javascript: links', async () => {
    const doc = await createDocument(alice, 'Link check');
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }],
        },
      ],
    };
    const res = await alice.patch(`/api/documents/${doc.id}`).send({ baseVersion: 1, content });
    expect(res.status).toBe(400);
  });

  it('enforces the title length limit', async () => {
    const doc = await createDocument(alice, 'Long title');
    const res = await alice.patch(`/api/documents/${doc.id}`).send({ baseVersion: 1, title: 'x'.repeat(201) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 409 with the latest version when two saves race', async () => {
    const doc = await createDocument(alice, 'Race');
    await alice.put(`/api/documents/${doc.id}/shares`).send({ email: BOB, role: 'editor' });

    const first = await bob
      .patch(`/api/documents/${doc.id}`)
      .send({ baseVersion: 1, content: paragraphDoc('Bob was here') });
    expect(first.status).toBe(200);

    // Alice still thinks she is on version 1.
    const stale = await alice
      .patch(`/api/documents/${doc.id}`)
      .send({ baseVersion: 1, content: paragraphDoc('Alice overwrites') });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('VERSION_CONFLICT');
    expect(stale.body.error.details.latest).toMatchObject({ version: 2, updatedBy: 'Bob Mirza' });

    const current = await alice.get(`/api/documents/${doc.id}`);
    expect(current.body.document.content.content[0].content[0].text).toBe('Bob was here');
  });

  it('returns 404 for unknown and malformed ids', async () => {
    expect((await alice.get('/api/documents/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await alice.get('/api/documents/not-a-uuid')).status).toBe(404);
  });

  it('lets only the owner delete', async () => {
    const doc = await createDocument(alice, 'Disposable');
    await alice.put(`/api/documents/${doc.id}/shares`).send({ email: BOB, role: 'editor' });

    expect((await bob.delete(`/api/documents/${doc.id}`)).status).toBe(403);
    expect((await alice.delete(`/api/documents/${doc.id}`)).status).toBe(204);
    expect((await alice.get(`/api/documents/${doc.id}`)).status).toBe(404);
  });
});
