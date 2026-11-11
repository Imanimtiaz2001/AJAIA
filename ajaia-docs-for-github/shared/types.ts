import type { JSONContent } from '@tiptap/core';
import type { Permissions, Role, ShareRole } from './permissions';

/** Wire format shared by the API and the web client. */

export interface UserDTO {
  id: string;
  email: string;
  name: string;
}

export type DocumentScope = 'all' | 'owned' | 'shared';

export interface DocumentSummaryDTO {
  id: string;
  title: string;
  snippet: string;
  role: Role;
  owner: UserDTO;
  updatedAt: string;
  updatedBy: string | null;
  collaboratorCount: number;
}

export interface DocumentDTO {
  id: string;
  title: string;
  content: JSONContent;
  version: number;
  role: Role;
  permissions: Permissions;
  owner: UserDTO;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface ShareDTO {
  user: UserDTO;
  role: ShareRole;
  createdAt: string;
}

export interface UpdateDocumentInput {
  baseVersion: number;
  title?: string;
  content?: JSONContent;
}

export interface ConvertedFileDTO {
  title: string;
  content: JSONContent;
}

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'UNREADABLE_FILE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}
