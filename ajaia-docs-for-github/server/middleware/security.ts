import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import type { ApiErrorBody } from '../../shared/types';
import { AppError } from '../lib/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-requested-with';

/**
 * CSRF defence in depth. The session cookie is SameSite=Lax, and every
 * state-changing request must also carry a custom header, which a cross-site
 * HTML form cannot set and a cross-origin fetch cannot send without CORS.
 */
export const requireCsrfHeader: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method) || req.get(CSRF_HEADER)) return next();
  next(new AppError(403, 'FORBIDDEN', 'Missing request header.'));
};

/** Per-app limiter (in-memory, per instance): slows down password guessing. */
export const createLoginRateLimit = (limit = 20) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      const body: ApiErrorBody = {
        error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Try again in a few minutes.' },
      };
      res.status(429).json(body);
    },
  });

export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

export function createErrorHandler(log: (error: unknown) => void = console.error): ErrorRequestHandler {
  return (error, _req, res, _next) => {
    const appError = toAppError(error);
    if (appError.status >= 500) log(error);
    const body: ApiErrorBody = {
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details === undefined ? {} : { details: appError.details }),
      },
    };
    res.status(appError.status).json(body);
  };
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof multer.MulterError) {
    return error.code === 'LIMIT_FILE_SIZE'
      ? new AppError(413, 'PAYLOAD_TOO_LARGE', 'That file is larger than the 2 MB limit.')
      : new AppError(400, 'BAD_REQUEST', 'Upload a single file in the "file" field.');
  }
  const status = (error as { status?: number; type?: string })?.status;
  if (status === 413) return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
  if (status === 400 && (error as { type?: string }).type === 'entity.parse.failed') {
    return new AppError(400, 'BAD_REQUEST', 'Request body is not valid JSON.');
  }
  return new AppError(500, 'INTERNAL', 'Something went wrong on our side. Please try again.');
}
