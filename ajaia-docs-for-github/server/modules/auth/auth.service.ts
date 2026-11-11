import type { UserDTO } from '../../../shared/types';
import type { Queryable } from '../../db';
import { createSessionToken, hashPassword, sha256, verifyPassword } from '../../lib/crypto';
import { Errors } from '../../lib/errors';
import type { UserRepository } from '../users/user.repository';

export interface Session {
  token: string;
  expiresAt: Date;
  user: UserDTO;
}

export class AuthService {
  /** Compared against when the email is unknown so response time does not reveal which accounts exist. */
  private readonly dummyHash = hashPassword('timing-equaliser-password');

  constructor(
    private readonly db: Queryable,
    private readonly users: UserRepository,
    private readonly sessionTtlMs: number,
  ) {}

  async login(email: string, password: string): Promise<Session> {
    const credentials = await this.users.findCredentials(email);
    const valid = await verifyPassword(password, credentials?.passwordHash ?? (await this.dummyHash));
    if (!credentials || !valid) throw Errors.invalidCredentials();

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + this.sessionTtlMs);
    await this.db.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
      sha256(token),
      credentials.user.id,
      expiresAt,
    ]);
    // Opportunistic cleanup keeps the table small without a cron job.
    await this.db.query('DELETE FROM sessions WHERE user_id = $1 AND expires_at < now()', [credentials.user.id]);
    return { token, expiresAt, user: credentials.user };
  }

  async resolve(token: string): Promise<UserDTO | null> {
    const [row] = await this.db.query<UserDTO>(
      `SELECT u.id, u.email, u.name
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [sha256(token)],
    );
    return row ?? null;
  }

  async logout(token: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  }
}
