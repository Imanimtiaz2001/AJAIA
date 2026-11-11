import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALICE, PASSWORD, createTestContext, signIn, type TestContext } from './helpers';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.db.close();
});

describe('authentication', () => {
  it('signs in a seeded user and returns them from /me', async () => {
    const alice = await signIn(ctx.app, ALICE);
    const me = await alice.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: ALICE, name: 'Alice Khan' });
    expect(me.body.user).not.toHaveProperty('password_hash');
  });

  it('sets an HttpOnly, SameSite session cookie', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'test')
      .send({ email: ALICE, password: PASSWORD });
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('rejects a wrong password and an unknown email with the same error', async () => {
    const attempt = (email: string, password: string) =>
      request(ctx.app).post('/api/auth/login').set('X-Requested-With', 'test').send({ email, password });

    const wrongPassword = await attempt(ALICE, 'not-the-password');
    const unknownUser = await attempt('nobody@ajaia.test', 'whatever-password');
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknownUser.body.error).toEqual(wrongPassword.body.error);
  });

  it('validates the login payload', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'test')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('requires a session for document routes', async () => {
    const res = await request(ctx.app).get('/api/documents');
    expect(res.status).toBe(401);
  });

  it('blocks state-changing requests without the CSRF header', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({ email: ALICE, password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it('invalidates the session server-side on logout', async () => {
    const login = await request(ctx.app)
      .post('/api/auth/login')
      .set('X-Requested-With', 'test')
      .send({ email: ALICE, password: PASSWORD });
    const cookie = String(login.headers['set-cookie']).split(';')[0]!;

    const logout = await request(ctx.app)
      .post('/api/auth/logout')
      .set('X-Requested-With', 'test')
      .set('Cookie', cookie);
    expect(logout.status).toBe(204);

    // Replaying the old cookie must not work: the session row is gone.
    const replay = await request(ctx.app).get('/api/auth/me').set('Cookie', cookie);
    expect(replay.status).toBe(401);
  });
});
