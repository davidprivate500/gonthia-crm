import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export type UserRole = 'owner' | 'admin' | 'member' | 'readonly';

export interface SessionData {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
  firstName?: string;
  lastName?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long',
  cookieName: 'gonthia-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  if (!session.userId) {
    return null;
  }

  return session;
}

export async function setSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  session.userId = data.userId;
  session.tenantId = data.tenantId;
  session.role = data.role;
  session.email = data.email;
  session.firstName = data.firstName;
  session.lastName = data.lastName;

  await session.save();
}

// Alias for consistency
export const createSession = setSession;

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  session.destroy();
}

// Permission helpers
export function canCreate(role: UserRole): boolean {
  return role !== 'readonly';
}

export function canUpdate(role: UserRole): boolean {
  return role !== 'readonly';
}

export function canDelete(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canInviteRole(currentRole: UserRole, targetRole: UserRole): boolean {
  if (currentRole === 'owner') {
    return true; // Owner can invite any role
  }
  if (currentRole === 'admin') {
    return targetRole === 'member' || targetRole === 'readonly';
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canChangeRole(currentRole: UserRole, targetRole: UserRole): boolean {
  return currentRole === 'owner';
}

export function canManageOrganization(role: UserRole): boolean {
  return role === 'owner';
}

export function canViewAuditLog(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageApiKeys(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canExportData(role: UserRole): boolean {
  return role === 'owner';
}
