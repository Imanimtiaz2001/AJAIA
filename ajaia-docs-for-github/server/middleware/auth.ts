import type { CookieOptions, NextFunction, Request, RequestHandler, Response } from 'express';
import type { UserDTO } from '../../shared/types';
import { Errors } from '../lib/errors';
import type { AuthService } from '../modules/auth/auth.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDTO;
      sessionToken?: string;
    }
  }
}

export interface SessionCookie {
  name: string;
  options: CookieOptions;
}

/** Over HTTPS the `__Host-` prefix pins the cookie to this exact origin (no subdomains, no plain HTTP). */
export function sessionCookie(secure: boolean): SessionCookie {
  return {
    name: secure ? '__Host-ajaia_sid' : 'ajaia_sid',
    options: { httpOnly: true, sameSite: 'lax', secure, path: '/' },
  };
}

export function requireUser(auth: AuthService, cookie: SessionCookie): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token: unknown = req.cookies?.[cookie.name];
    const user = typeof token === 'string' && token.length > 0 ? await auth.resolve(token) : null;
    if (!user) {
      if (token) res.clearCookie(cookie.name, cookie.options);
      throw Errors.unauthenticated();
    }
    req.user = user;
    req.sessionToken = token as string;
    next();
  };
}

/** Narrowing helper for handlers mounted behind `requireUser`. */
export function currentUser(req: Request): UserDTO {
  if (!req.user) throw Errors.unauthenticated();
  return req.user;
}
