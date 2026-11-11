import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ALICE,
  BOB,
  CAROL,
  createDocument,
  createTestContext,
  listTitles,
  paragraphDoc,
  signIn,
  type Client,
  type TestContext,
} from './helpers';

let ctx: TestContext;
let alice: Client;
let bob: Client;
let carol: Client;

beforeAll(async () => {
  ctx = await createTestContext();
  [alice, bob, carol] = await Promise.all([signIn(ctx.app, ALICE), signIn(ctx.app, BOB), signIn(ctx.app, CAROL)]);
});
afterAll(async () => {
  await ctx.db.close();
});

describe('sharing and access control', () => {
  it('hides a private document from everyone but the owner', async () => {
    const doc = await createDocument(alice, 'Private roadmap');
    expect((await bob.get(`/api/documents/${doc.id}`)).status).toBe(404);
    expect(await listTitles(bob, 'all')).not.toContain('Private roadmap');
  });

  it('separates owned and shared documents in the lists', async () => {
    const doc = await createDocument(alice, 'Shared spec');
    const grant = await alice.put(`/api/documents/${doc.id}/shares`).send({ email: BOB, role: 'viewer' });
    expect(grant.status).toBe(200);
    expect(grant.body.shares).toEqual([
      expect.objectContaining({ role: 'viewer', user: expect.objectContaining({ email: BOB }) }),
    ]);

    expect(await listTitles(alice, 'owned')).toContain('Shared spec');
    expect(await listTitles(alice, 'shared')).not.toContain('Shared spec');
    expect(await listTitles(bob, 'shared')).toContain('Shared spec');
    expect(await listTitles(bob, 'owned')).not.toContain('Shared spec');

    const bobView = await bob.get(`/api/documents/${doc.id}`);
    expect(bobView.body.document).toMatchObject({
      role: 'viewer',
      owner: { email: ALICE },
      permissions: { canEdit: false, canShare: false, canDelete: false },
    });
  });

  it('lets a viewer read but not edit, and an editor edit but not share', async () => {
    const doc = await createDocument(alice, 'Roles');
    await alice.put(`/api/documents/${doc.id}/shares`).send({ email: BOB, role: 'viewer' });

    const viewerEdit = await bob
      .patch(`/api/documents/${doc.id}`)
      .send({ baseVersion: 1, content: paragraphDoc('nope') });
    expect(viewerEdit.status).toBe(403);

    // Upgrading an existing grant changes the role rather than duplicating it.
    const upgrade = await alice.put(`/api/documents/${doc.id}/shares`).send({ email: BOB, role: 'editor' });
    expect(upgrade.body.shares).toHaveLength(1);
    expect(upgrade.body.shares[0].role).toBe('editor');

    const editorEdit = await bob
      .patch(`/api/documents/${doc.id}`)
      .send({ baseVersion: 1, content: paragraphDoc('yes') });
    expect(editorEdit.status).toBe(200);

    const editorShares = await bob.put(`/api/documents/${doc.id}/shares`).send({ email: CAROL, role: 'viewer' });
    expect(editorShares.status).toBe(403);
  });

  it('revokes access immediately', async () => {
    const doc = await createDocument(alice, 'Temporary access');
    const grant = await alice.put(`/api/documents/${doc.id}/shares`).send({ email: CAROL, role: 'editor' });
    const carolId = grant.body.shares[0].user.id as string;
    expect((await carol.get(`/api/documents/${doc.id}`)).status).toBe(200);

    const revoke = await alice.delete(`/api/documents/${doc.id}/shares/${carolId}`);
    expect(revoke.status).toBe(200);
    expect(revoke.body.shares).toEqual([]);
    expect((await carol.get(`/api/documents/${doc.id}`)).status).toBe(404);
  });

  it('validates share requests', async () => {
    const doc = await createDocument(alice, 'Validation');
    const unknown = await alice
      .put(`/api/documents/${doc.id}/shares`)
      .send({ email: 'ghost@ajaia.test', role: 'viewer' });
    expect(unknown.status).toBe(404);

    const self = await alice.put(`/api/documents/${doc.id}/shares`).send({ email: ALICE, role: 'editor' });
    expect(self.status).toBe(400);

    const badRole = await alice.put(`/api/documents/${doc.id}/shares`).send({ email: BOB, role: 'admin' });
    expect(badRole.status).toBe(400);
  });

  it('ships the seeded demo data with both kinds of share', async () => {
    const bobShared = await bob.get('/api/documents?scope=shared');
    expect(bobShared.body.documents).toContainEqual(
      expect.objectContaining({
        title: 'Q3 Product Planning',
        role: 'editor',
        owner: expect.objectContaining({ email: ALICE }),
      }),
    );
    const aliceShared = await alice.get('/api/documents?scope=shared');
    expect(aliceShared.body.documents).toContainEqual(
      expect.objectContaining({
        title: 'Team Onboarding Checklist',
        role: 'viewer',
        owner: expect.objectContaining({ email: BOB }),
      }),
    );
  });
});
