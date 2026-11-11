import type { ShareRole } from '../../../shared/permissions';
import type { ShareDTO, UserDTO } from '../../../shared/types';
import { AppError, Errors } from '../../lib/errors';
import type { DocumentAccess } from '../documents/document-access';
import type { UserRepository } from '../users/user.repository';
import type { ShareRepository } from './share.repository';

export class ShareService {
  constructor(
    private readonly shares: ShareRepository,
    private readonly users: UserRepository,
    private readonly access: DocumentAccess,
  ) {}

  /** Anyone with access can see who else has access; only the owner can change it. */
  async list(user: UserDTO, documentId: string): Promise<ShareDTO[]> {
    await this.access.require(user, documentId, 'read');
    return this.shares.list(documentId);
  }

  async grant(user: UserDTO, documentId: string, email: string, role: ShareRole): Promise<ShareDTO[]> {
    const doc = await this.access.require(user, documentId, 'share');
    const target = await this.users.findByEmail(email);
    if (!target) throw new AppError(404, 'NOT_FOUND', `No account uses ${email}.`);
    if (target.id === doc.owner.id) throw Errors.badRequest('The owner already has full access.');

    await this.shares.upsert(documentId, target.id, role, user.id);
    return this.shares.list(documentId);
  }

  async revoke(user: UserDTO, documentId: string, userId: string): Promise<ShareDTO[]> {
    await this.access.require(user, documentId, 'share');
    const removed = await this.shares.remove(documentId, userId);
    if (!removed) throw Errors.notFound('Collaborator');
    return this.shares.list(documentId);
  }
}
