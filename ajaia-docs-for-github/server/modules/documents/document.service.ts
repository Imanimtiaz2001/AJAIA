import { randomUUID } from 'node:crypto';
import type { JSONContent } from '@tiptap/core';
import { EMPTY_DOCUMENT } from '../../../shared/editor';
import { DEFAULT_DOCUMENT_TITLE } from '../../../shared/limits';
import { permissionsFor } from '../../../shared/permissions';
import type {
  DocumentDTO,
  DocumentScope,
  DocumentSummaryDTO,
  UpdateDocumentInput,
  UserDTO,
} from '../../../shared/types';
import { Errors } from '../../lib/errors';
import { normalizeContent } from './content';
import type { DocumentAccess } from './document-access';
import type { DocumentRecord, DocumentRepository } from './document.repository';

export const toDocumentDTO = (doc: DocumentRecord): DocumentDTO => ({
  ...doc,
  permissions: permissionsFor(doc.role),
});

export interface CreateDocumentInput {
  title?: string;
  content?: JSONContent;
}

export class DocumentService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly access: DocumentAccess,
  ) {}

  list(user: UserDTO, scope: DocumentScope): Promise<DocumentSummaryDTO[]> {
    return this.documents.listForUser(user.id, scope);
  }

  async get(user: UserDTO, documentId: string): Promise<DocumentDTO> {
    return toDocumentDTO(await this.access.require(user, documentId, 'read'));
  }

  async create(user: UserDTO, input: CreateDocumentInput): Promise<DocumentDTO> {
    const { content, text } = normalizeContent(input.content ?? EMPTY_DOCUMENT);
    const id = randomUUID();
    await this.documents.insert({
      id,
      ownerId: user.id,
      title: input.title?.trim() || DEFAULT_DOCUMENT_TITLE,
      content,
      contentText: text,
    });
    return this.get(user, id);
  }

  async update(user: UserDTO, documentId: string, input: UpdateDocumentInput): Promise<DocumentDTO> {
    await this.access.require(user, documentId, 'edit');

    const normalized = input.content === undefined ? undefined : normalizeContent(input.content);
    const saved = await this.documents.update(documentId, input.baseVersion, user.id, {
      title: input.title === undefined ? undefined : input.title.trim() || DEFAULT_DOCUMENT_TITLE,
      content: normalized?.content,
      contentText: normalized?.text,
    });

    if (!saved) {
      const latest = await this.access.require(user, documentId, 'read');
      throw Errors.versionConflict({ latest: toDocumentDTO(latest) });
    }
    return this.get(user, documentId);
  }

  async delete(user: UserDTO, documentId: string): Promise<void> {
    await this.access.require(user, documentId, 'delete');
    await this.documents.delete(documentId);
  }
}
