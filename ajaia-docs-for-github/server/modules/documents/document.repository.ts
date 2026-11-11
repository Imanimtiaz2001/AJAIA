import type { JSONContent } from '@tiptap/core';
import type { Role } from '../../../shared/permissions';
import type { DocumentScope, DocumentSummaryDTO, UserDTO } from '../../../shared/types';
import type { Queryable } from '../../db';
import { toIso } from '../../lib/validation';

export interface DocumentRecord {
  id: string;
  title: string;
  content: JSONContent;
  version: number;
  role: Role;
  owner: UserDTO;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

interface DocumentRow {
  id: string;
  title: string;
  content: JSONContent;
  version: number;
  role: Role;
  owner_id: string;
  owner_email: string;
  owner_name: string;
  created_at: Date;
  updated_at: Date;
  updated_by_name: string | null;
}

interface SummaryRow extends Omit<DocumentRow, 'content' | 'version' | 'created_at'> {
  content_text: string;
  collaborator_count: number;
}

/**
 * Every read is scoped to a user and resolves that user's role in SQL, so a
 * document the user cannot access is indistinguishable from one that does not exist.
 */
const ACCESSIBLE_DOCUMENTS = /* sql */ `
  FROM documents d
  JOIN users o ON o.id = d.owner_id
  LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = $1
  LEFT JOIN users ub ON ub.id = d.updated_by
  WHERE (d.owner_id = $1 OR s.user_id IS NOT NULL)`;

const ROLE_SQL = `CASE WHEN d.owner_id = $1 THEN 'owner' ELSE s.role END AS role`;
const OWNER_SQL = `o.id AS owner_id, o.email AS owner_email, o.name AS owner_name, ub.name AS updated_by_name`;

const SCOPE_FILTER: Record<DocumentScope, string> = {
  all: '',
  owned: 'AND d.owner_id = $1',
  shared: 'AND d.owner_id <> $1',
};

const owner = (row: Pick<DocumentRow, 'owner_id' | 'owner_email' | 'owner_name'>): UserDTO => ({
  id: row.owner_id,
  email: row.owner_email,
  name: row.owner_name,
});

const toRecord = (row: DocumentRow): DocumentRecord => ({
  id: row.id,
  title: row.title,
  content: row.content,
  version: row.version,
  role: row.role,
  owner: owner(row),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
  updatedBy: row.updated_by_name,
});

export interface NewDocument {
  id: string;
  ownerId: string;
  title: string;
  content: JSONContent;
  contentText: string;
}

export interface DocumentChanges {
  title?: string;
  content?: JSONContent;
  contentText?: string;
}

export class DocumentRepository {
  constructor(private readonly db: Queryable) {}

  async listForUser(userId: string, scope: DocumentScope): Promise<DocumentSummaryDTO[]> {
    const rows = await this.db.query<SummaryRow>(
      `SELECT d.id, d.title, d.content_text, d.updated_at, ${ROLE_SQL}, ${OWNER_SQL},
              (SELECT count(*)::int FROM document_shares x WHERE x.document_id = d.id) AS collaborator_count
       ${ACCESSIBLE_DOCUMENTS} ${SCOPE_FILTER[scope]}
       ORDER BY d.updated_at DESC
       LIMIT 500`,
      [userId],
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      snippet: row.content_text,
      role: row.role,
      owner: owner(row),
      updatedAt: toIso(row.updated_at),
      updatedBy: row.updated_by_name,
      collaboratorCount: row.collaborator_count,
    }));
  }

  async findForUser(documentId: string, userId: string): Promise<DocumentRecord | null> {
    const [row] = await this.db.query<DocumentRow>(
      `SELECT d.id, d.title, d.content, d.version, d.created_at, d.updated_at, ${ROLE_SQL}, ${OWNER_SQL}
       ${ACCESSIBLE_DOCUMENTS} AND d.id = $2`,
      [userId, documentId],
    );
    return row ? toRecord(row) : null;
  }

  async insert(doc: NewDocument): Promise<void> {
    await this.db.query(
      `INSERT INTO documents (id, owner_id, title, content, content_text, updated_by)
       VALUES ($1, $2, $3, $4::jsonb, $5, $2)`,
      [doc.id, doc.ownerId, doc.title, JSON.stringify(doc.content), doc.contentText],
    );
  }

  /**
   * Optimistic concurrency: the write only lands if nobody else has saved since
   * `baseVersion`. Returns false on a lost race so the caller can report a conflict.
   */
  async update(documentId: string, baseVersion: number, editorId: string, changes: DocumentChanges): Promise<boolean> {
    const rows = await this.db.query(
      `UPDATE documents
          SET title        = COALESCE($3, title),
              content      = COALESCE($4::jsonb, content),
              content_text = COALESCE($5, content_text),
              version      = version + 1,
              updated_at   = now(),
              updated_by   = $6
        WHERE id = $1 AND version = $2
        RETURNING id`,
      [
        documentId,
        baseVersion,
        changes.title ?? null,
        changes.content === undefined ? null : JSON.stringify(changes.content),
        changes.contentText ?? null,
        editorId,
      ],
    );
    return rows.length === 1;
  }

  async delete(documentId: string): Promise<void> {
    await this.db.query('DELETE FROM documents WHERE id = $1', [documentId]);
  }
}
