import type { SessionUser } from '@/shared/auth/session';

/** Role user pada sistem (docs/api/auth, role matrix Section 22 API doc). */
export const ROLES = ['root', 'admin', 'reviewer', 'editor', 'contributor'] as const;
export type UserRole = (typeof ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  root: 'Root',
  admin: 'Admin',
  reviewer: 'Reviewer',
  editor: 'Editor',
  contributor: 'Kontributor',
};

export type User = SessionUser;

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthSessionResult {
  accessToken: string;
  expiresIn: number;
  user: User;
}