import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export type UserRole = 'owner' | 'admin' | 'member' | 'readonly';

export interface SessionData {
  userId: string;
  tenantId: string | null; // null for master admins
  role: UserRole;
  email: string;
  firstName?: string;
  lastName?: string;
  isMasterAdmin?: boolean; // Platform-level admin with cross-tenant access
}

// BUG-003 FIX: Validate SESSION_SECRET at startup
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error(
      'SESSION_SECRET environment variable is required. ' +
      'Generate a secure secret with: openssl rand -hex 32'
    );
  }

  if (secret.length < 32) {
    throw new Error(
      'SESSION_SECRET must be at least 32 characters long. ' +
      'Current length: ' + secret.length
    );
  }

  return secret;
}

export const sessionOptions: SessionOptions = {
  password: getSessionSecret(),
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
  session.isMasterAdmin = data.isMasterAdmin;

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

// Master admin permissions
export function isMasterAdminSession(session: SessionData | null): boolean {
  return session?.isMasterAdmin === true;
}
