/**
 * Access policy shared by the API (enforcement) and the UI (affordances).
 * The server is always the authority; the client only uses this to hide
 * controls a user cannot use.
 */
export const SHARE_ROLES = ['viewer', 'editor'] as const;
export type ShareRole = (typeof SHARE_ROLES)[number];
export type Role = 'owner' | ShareRole;

export const ACTIONS = ['read', 'edit', 'share', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];

const POLICY: Readonly<Record<Role, ReadonlySet<Action>>> = {
  owner: new Set<Action>(['read', 'edit', 'share', 'delete']),
  editor: new Set<Action>(['read', 'edit']),
  viewer: new Set<Action>(['read']),
};

export function can(role: Role | null | undefined, action: Action): boolean {
  return role ? POLICY[role].has(action) : false;
}

export interface Permissions {
  canEdit: boolean;
  canShare: boolean;
  canDelete: boolean;
}

export function permissionsFor(role: Role): Permissions {
  return {
    canEdit: can(role, 'edit'),
    canShare: can(role, 'share'),
    canDelete: can(role, 'delete'),
  };
}

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  owner: 'Owner',
  editor: 'Can edit',
  viewer: 'Can view',
};
