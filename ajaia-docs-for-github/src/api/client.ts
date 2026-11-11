import type { ShareRole } from '../../shared/permissions';
import type {
  ConvertedFileDTO,
  DocumentDTO,
  DocumentScope,
  DocumentSummaryDTO,
  ShareDTO,
  UpdateDocumentInput,
  UserDTO,
} from '../../shared/types';
import { request } from './http';

const fileForm = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return form;
};

export const api = {
  auth: {
    me: () => request<{ user: UserDTO }>('/auth/me').then((r) => r.user),
    login: (email: string, password: string) =>
      request<{ user: UserDTO }>('/auth/login', { method: 'POST', json: { email, password } }).then((r) => r.user),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
  },
  users: {
    list: () => request<{ users: UserDTO[] }>('/users').then((r) => r.users),
  },
  documents: {
    list: (scope: DocumentScope) =>
      request<{ documents: DocumentSummaryDTO[] }>(`/documents?scope=${scope}`).then((r) => r.documents),
    get: (id: string, signal?: AbortSignal) =>
      request<{ document: DocumentDTO }>(`/documents/${id}`, { signal }).then((r) => r.document),
    create: (title?: string) =>
      request<{ document: DocumentDTO }>('/documents', { method: 'POST', json: { title } }).then((r) => r.document),
    update: (id: string, input: UpdateDocumentInput) =>
      request<{ document: DocumentDTO }>(`/documents/${id}`, { method: 'PATCH', json: input }).then((r) => r.document),
    remove: (id: string) => request<void>(`/documents/${id}`, { method: 'DELETE' }),
  },
  shares: {
    list: (documentId: string) =>
      request<{ shares: ShareDTO[] }>(`/documents/${documentId}/shares`).then((r) => r.shares),
    grant: (documentId: string, email: string, role: ShareRole) =>
      request<{ shares: ShareDTO[] }>(`/documents/${documentId}/shares`, { method: 'PUT', json: { email, role } }).then(
        (r) => r.shares,
      ),
    revoke: (documentId: string, userId: string) =>
      request<{ shares: ShareDTO[] }>(`/documents/${documentId}/shares/${userId}`, { method: 'DELETE' }).then(
        (r) => r.shares,
      ),
  },
  imports: {
    createDocument: (file: File) =>
      request<{ document: DocumentDTO }>('/imports/documents', { method: 'POST', form: fileForm(file) }).then(
        (r) => r.document,
      ),
    convert: (file: File) =>
      request<{ file: ConvertedFileDTO }>('/imports/convert', { method: 'POST', form: fileForm(file) }).then(
        (r) => r.file,
      ),
  },
};

export const queryKeys = {
  me: ['me'] as const,
  users: ['users'] as const,
  documents: (scope: DocumentScope) => ['documents', scope] as const,
  allDocumentLists: ['documents'] as const,
  shares: (documentId: string) => ['shares', documentId] as const,
};
