import type { UserDTO } from '../../../shared/types';
import type { Queryable } from '../../db';

interface UserRow {
  id: string;
  email: string;
  name: string;
}

interface UserWithHashRow extends UserRow {
  password_hash: string;
}

const toUser = (row: UserRow): UserDTO => ({ id: row.id, email: row.email, name: row.name });

export class UserRepository {
  constructor(private readonly db: Queryable) {}

  async findByEmail(email: string): Promise<UserDTO | null> {
    const [row] = await this.db.query<UserRow>('SELECT id, email, name FROM users WHERE lower(email) = lower($1)', [
      email,
    ]);
    return row ? toUser(row) : null;
  }

  async findCredentials(email: string): Promise<{ user: UserDTO; passwordHash: string } | null> {
    const [row] = await this.db.query<UserWithHashRow>(
      'SELECT id, email, name, password_hash FROM users WHERE lower(email) = lower($1)',
      [email],
    );
    return row ? { user: toUser(row), passwordHash: row.password_hash } : null;
  }

  /** Directory used by the share dialog. Internal tool: every account can see every other account. */
  async listAllExcept(userId: string): Promise<UserDTO[]> {
    const rows = await this.db.query<UserRow>('SELECT id, email, name FROM users WHERE id <> $1 ORDER BY name', [
      userId,
    ]);
    return rows.map(toUser);
  }
}
