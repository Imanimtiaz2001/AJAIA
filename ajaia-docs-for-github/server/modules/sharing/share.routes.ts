import { Router } from 'express';
import { z } from 'zod';
import { SHARE_ROLES } from '../../../shared/permissions';
import { parseId, parseInput } from '../../lib/validation';
import { currentUser } from '../../middleware/auth';
import type { ShareService } from './share.service';

const GrantBody = z.object({
  email: z.email('Enter a valid email address.').max(254),
  role: z.enum(SHARE_ROLES),
});

/** Mounted at /api/documents/:id/shares */
export function shareRoutes(shares: ShareService): Router {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res) => {
    const id = parseId((req.params as { id?: string }).id);
    res.json({ shares: await shares.list(currentUser(req), id) });
  });

  router.put('/', async (req, res) => {
    const id = parseId((req.params as { id?: string }).id);
    const { email, role } = parseInput(GrantBody, req.body);
    res.json({ shares: await shares.grant(currentUser(req), id, email, role) });
  });

  router.delete('/:userId', async (req, res) => {
    const id = parseId((req.params as { id?: string }).id);
    const userId = parseId(req.params.userId, 'Collaborator');
    res.json({ shares: await shares.revoke(currentUser(req), id, userId) });
  });

  return router;
}
