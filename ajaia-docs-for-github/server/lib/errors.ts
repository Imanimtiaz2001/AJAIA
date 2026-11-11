import type { ErrorCode } from '../../shared/types';

/** An error that is safe to show to the client. Anything else becomes a generic 500. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  badRequest: (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details),
  validation: (details: unknown) => new AppError(400, 'VALIDATION_FAILED', 'Some fields are invalid.', details),
  unauthenticated: () => new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.'),
  invalidCredentials: () => new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'),
  forbidden: (message = 'You do not have permission to do that.') => new AppError(403, 'FORBIDDEN', message),
  notFound: (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found.`),
  versionConflict: (details: unknown) =>
    new AppError(409, 'VERSION_CONFLICT', 'This document was changed by someone else since you opened it.', details),
  payloadTooLarge: (message: string) => new AppError(413, 'PAYLOAD_TOO_LARGE', message),
  unsupportedFileType: (message: string) => new AppError(415, 'UNSUPPORTED_FILE_TYPE', message),
  unreadableFile: (message: string) => new AppError(422, 'UNREADABLE_FILE', message),
};
