import { Router } from 'express';
import { z } from 'zod';
import { LIMITS } from '../../../shared/limits';
import type { JSONContent } from '@tiptap/core';
import { parseId, parseInput } from '../../lib/validation';
import { currentUser } from '../../middleware/auth';
import type { DocumentService } from './document.service';

const Title = z.string().max(LIMITS.titleMaxLength, `Title must be ${LIMITS.titleMaxLength} characters or fewer.`);
/** Structure is validated against the editor schema in the service; here we only require an object. */
const Content = z.custom<JSONContent>((value) => typeof value === 'object' && value !== null && !Array.isArray(value), {
  message: 'Content must be an editor document.',
});

const ListQuery = z.object({ scope: z.enum(['all', 'owned', 'shared']).default('all') });
const CreateBody = z.object({ title: Title.optional(), content: Content.optional() }).strict();
const UpdateBody = z
  .object({
    baseVersion: z.number().int().positive(),
    title: Title.optional(),
    content: Content.optional(),
  })
  .strict()
  .refine((body) => body.title !== undefined || body.content !== undefined, {
    message: 'Provide a title or content to update.',
  });

export function documentRoutes(documents: DocumentService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { scope } = parseInput(ListQuery, req.query);
    res.json({ documents: await documents.list(currentUser(req), scope) });
  });

  router.post('/', async (req, res) => {
    const body = parseInput(CreateBody, req.body ?? {});
    res.status(201).json({ document: await documents.create(currentUser(req), body) });
  });

  router.get('/:id', async (req, res) => {
    res.json({ document: await documents.get(currentUser(req), parseId(req.params.id)) });
  });

  router.patch('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const body = parseInput(UpdateBody, req.body);
    res.json({ document: await documents.update(currentUser(req), id, body) });
  });

  router.delete('/:id', async (req, res) => {
    await documents.delete(currentUser(req), parseId(req.params.id));
    res.status(204).end();
  });

  return router;
}
