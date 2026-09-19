export type AdminUserRole = 'contributor' | 'editor' | 'reviewer' | 'admin' | 'root';

export interface AdminUserListItem {
  id: string;
  username: string;
  email: string;
  role: AdminUserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export const ROLE_LABELS: Record<AdminUserRole, string> = {
  root: 'Root',
  admin: 'Admin',
  reviewer: 'Reviewer',
  editor: 'Editor',
  contributor: 'Kontributor',
};

export const ROLE_TAG_COLOR: Record<AdminUserRole, string> = {
  root: 'magenta',
  admin: 'geekblue',
  reviewer: 'cyan',
  editor: 'gold',
  contributor: 'default',
};

export const CHANGEABLE_ROLES: Exclude<AdminUserRole, 'root'>[] = [
  'contributor',
  'editor',
  'reviewer',
  'admin',
];

export const ROLE_OPTIONS_SELECT: { value: Exclude<AdminUserRole, 'root'>; label: string }[] =
  CHANGEABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
