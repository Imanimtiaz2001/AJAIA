import type { ShareRole } from '../../../shared/permissions';
import type { ShareDTO } from '../../../shared/types';
import type { Queryable } from '../../db';
import { toIso } from '../../lib/validation';

interface ShareRow {
  user_id: string;
  email: string;
  name: string;
  role: ShareRole;
  created_at: Date;
}

export class ShareRepository {
  constructor(private readonly db: Queryable) {}

  async list(documentId: string): Promise<ShareDTO[]> {
    const rows = await this.db.query<ShareRow>(
      `SELECT s.user_id, u.email, u.name, s.role, s.created_at
         FROM document_shares s JOIN users u ON u.id = s.user_id
        WHERE s.document_id = $1
        ORDER BY u.name`,
      [documentId],
    );
    return rows.map((row) => ({
      user: { id: row.user_id, email: row.email, name: row.name },
      role: row.role,
      createdAt: toIso(row.created_at),
    }));
  }

  /** Grants access, or changes the role of an existing grant. */
  async upsert(documentId: string, userId: string, role: ShareRole, grantedBy: string): Promise<void> {
    await this.db.query(
      `INSERT INTO document_shares (document_id, user_id, role, granted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (document_id, user_id) DO UPDATE SET role = EXCLUDED.role, granted_by = EXCLUDED.granted_by`,
      [documentId, userId, role, grantedBy],
    );
  }

  async remove(documentId: string, userId: string): Promise<boolean> {
    const rows = await this.db.query(
      'DELETE FROM document_shares WHERE document_id = $1 AND user_id = $2 RETURNING user_id',
      [documentId, userId],
    );
    return rows.length > 0;
  }
}
