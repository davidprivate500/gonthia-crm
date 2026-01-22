import { getIronSession, SessionOptions, sealData } from 'iron-session';
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
    // Explicit path ensures cookie is valid for all routes
    path: '/',
    // Only require secure in production (HTTPS)
    // In dev, leaving as false allows both HTTP and HTTPS
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    // Use 'lax' for reasonable CSRF protection while allowing normal navigation
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
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

/**
 * Create a sealed session cookie value that can be manually set in response headers.
 * Use this as a workaround for Next.js 15+ cookie handling issues.
 */
export async function createSessionCookie(data: SessionData): Promise<string> {
  const sealed = await sealData(data, {
    password: sessionOptions.password,
    ttl: sessionOptions.cookieOptions?.maxAge || 60 * 60 * 24 * 7,
  });
  return sealed;
}

/**
 * Get the Set-Cookie header value for a session
 */
export function getSessionCookieHeader(sealedValue: string): string {
  const opts = sessionOptions.cookieOptions || {};
  const parts = [
    `${sessionOptions.cookieName}=${sealedValue}`,
    `Path=${opts.path || '/'}`,
    `Max-Age=${opts.maxAge || 604800}`,
  ];

  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);

  return parts.join('; ');
}

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
