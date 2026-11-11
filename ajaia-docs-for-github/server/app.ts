import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import cookieParser from 'cookie-parser';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import type { AppConfig } from './config';
import type { Database } from './db';
import { Errors } from './lib/errors';
import { requireUser, sessionCookie } from './middleware/auth';
import { createErrorHandler, noStore, requireCsrfHeader } from './middleware/security';
import { authRoutes } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import { DocumentAccess } from './modules/documents/document-access';
import { DocumentRepository } from './modules/documents/document.repository';
import { documentRoutes } from './modules/documents/document.routes';
import { DocumentService } from './modules/documents/document.service';
import { importRoutes } from './modules/imports/import.routes';
import { ShareRepository } from './modules/sharing/share.repository';
import { shareRoutes } from './modules/sharing/share.routes';
import { ShareService } from './modules/sharing/share.service';
import { UserRepository } from './modules/users/user.repository';
import { userRoutes } from './modules/users/user.routes';

export interface AppOptions {
  config: AppConfig;
  db: Database;
  /** Directory with the built SPA. When set, the API process also serves the web client. */
  clientDir?: string;
  loginAttemptLimit?: number;
}

/** Composition root: wires repositories → services → routes. No module reaches for globals. */
export function createApp({ config, db, clientDir, loginAttemptLimit }: AppOptions): Express {
  const users = new UserRepository(db);
  const documentsRepo = new DocumentRepository(db);
  const access = new DocumentAccess(documentsRepo);
  const auth = new AuthService(db, users, config.sessionTtlMs);
  const documents = new DocumentService(documentsRepo, access);
  const shares = new ShareService(new ShareRepository(db), users, access);
  const cookie = sessionCookie(config.secureCookies);
  const authenticated = requireUser(auth, cookie);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());

  const api = Router();
  api.use(noStore, express.json({ limit: '1.5mb' }), cookieParser(), requireCsrfHeader);
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  api.use('/auth', authRoutes(auth, cookie, loginAttemptLimit));
  api.use('/users', authenticated, userRoutes(users));
  api.use('/documents/:id/shares', authenticated, shareRoutes(shares));
  api.use('/documents', authenticated, documentRoutes(documents));
  api.use('/imports', authenticated, importRoutes(documents));
  api.use(() => {
    throw Errors.notFound('Endpoint');
  });
  app.use('/api', api);

  if (clientDir && existsSync(clientDir)) {
    const root = resolve(clientDir);
    app.use(express.static(root, { index: false, maxAge: '1h' }));
    // SPA fallback: every non-API GET renders the app shell.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(resolve(root, 'index.html'));
    });
  }

  app.use(createErrorHandler());
  return app;
}
