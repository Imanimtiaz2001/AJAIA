import { Router } from 'express';
import { z } from 'zod';
import { parseInput } from '../../lib/validation';
import { currentUser, requireUser, type SessionCookie } from '../../middleware/auth';
import { createLoginRateLimit } from '../../middleware/security';
import type { AuthService } from './auth.service';

const LoginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

export function authRoutes(auth: AuthService, cookie: SessionCookie, loginAttemptLimit?: number): Router {
  const router = Router();
  const loginRateLimit = createLoginRateLimit(loginAttemptLimit);

  router.post('/login', loginRateLimit, async (req, res) => {
    const { email, password } = parseInput(LoginSchema, req.body);
    const session = await auth.login(email, password);
    res.cookie(cookie.name, session.token, { ...cookie.options, expires: session.expiresAt });
    res.json({ user: session.user });
  });

  router.post('/logout', async (req, res) => {
    const token: unknown = req.cookies?.[cookie.name];
    if (typeof token === 'string' && token) await auth.logout(token);
    res.clearCookie(cookie.name, cookie.options);
    res.status(204).end();
  });

  router.get('/me', requireUser(auth, cookie), (req, res) => {
    res.json({ user: currentUser(req) });
  });

  return router;
}
