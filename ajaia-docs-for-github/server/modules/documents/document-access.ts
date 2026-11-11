import { can, type Action } from '../../../shared/permissions';
import type { UserDTO } from '../../../shared/types';
import { Errors } from '../../lib/errors';
import type { DocumentRecord, DocumentRepository } from './document.repository';

const FORBIDDEN_MESSAGES: Record<Action, string> = {
  read: 'You do not have access to this document.',
  edit: 'You have view-only access to this document.',
  share: 'Only the owner can manage sharing for this document.',
  delete: 'Only the owner can delete this document.',
};

/**
 * Single enforcement point for document authorisation. Services call this
 * instead of re-implementing role checks.
 */
export class DocumentAccess {
  constructor(private readonly documents: DocumentRepository) {}

  async require(user: UserDTO, documentId: string, action: Action): Promise<DocumentRecord> {
    const doc = await this.documents.findForUser(documentId, user.id);
    // No access at all is reported as 404 so document ids cannot be probed.
    if (!doc) throw Errors.notFound('Document');
    if (!can(doc.role, action)) throw Errors.forbidden(FORBIDDEN_MESSAGES[action]);
    return doc;
  }
}
