import { Router } from 'express';
import { currentUser } from '../../middleware/auth';
import type { UserRepository } from './user.repository';

export function userRoutes(users: UserRepository): Router {
  const router = Router();
  router.get('/', async (req, res) => {
    res.json({ users: await users.listAllExcept(currentUser(req).id) });
  });
  return router;
}
