import { Router } from 'express';
import multer from 'multer';
import { LIMITS } from '../../../shared/limits';
import { currentUser } from '../../middleware/auth';
import type { DocumentService } from '../documents/document.service';
import { convertUpload, type UploadedFile } from './converters';

/** Files are held in memory only (max 2 MB) and never written to disk or storage. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.uploadMaxBytes, files: 1, fields: 5 },
}).single('file');

const toUploadedFile = (file: Express.Multer.File | undefined): UploadedFile | undefined =>
  file && {
    // Browsers send UTF-8 names, multer decodes them as latin1.
    originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
    buffer: file.buffer,
  };

export function importRoutes(documents: DocumentService): Router {
  const router = Router();

  /** Upload a file and turn it into a new document owned by the caller. */
  router.post('/documents', upload, async (req, res) => {
    const converted = await convertUpload(toUploadedFile(req.file));
    const document = await documents.create(currentUser(req), {
      title: converted.title,
      content: converted.content,
    });
    res.status(201).json({ document });
  });

  /** Convert a file without saving it, so the editor can insert it into the current draft. */
  router.post('/convert', upload, async (req, res) => {
    const { title, content } = await convertUpload(toUploadedFile(req.file));
    res.json({ file: { title, content } });
  });

  return router;
}
