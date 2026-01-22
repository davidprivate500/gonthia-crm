import { db, auditLogs } from '@/lib/db';

// BUG-009 FIX: Extended AuditAction to include auth events
export type AuditAction = 'create' | 'update' | 'delete' | 'login_success' | 'login_failed' | 'logout' | 'password_reset_request' | 'password_reset_success';

// BUG-017 FIX: Track audit failures for monitoring
let auditFailureCount = 0;
const AUDIT_FAILURE_THRESHOLD = 5;
const AUDIT_FAILURE_RESET_INTERVAL = 60000; // 1 minute

// Reset failure count periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    if (auditFailureCount > 0) {
      console.warn('[AUDIT] Resetting failure count from', auditFailureCount);
    }
    auditFailureCount = 0;
  }, AUDIT_FAILURE_RESET_INTERVAL);
}

/**
 * BUG-017 FIX: Structured error logging for audit failures
 * Logs errors in a format suitable for log aggregation and alerting
 */
function logAuditError(context: string, entry: Partial<AuditLogEntry | AuthAuditLogEntry>, error: unknown): void {
  auditFailureCount++;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Structured log format for monitoring systems
  console.error(JSON.stringify({
    level: 'error',
    service: 'audit-logger',
    context,
    timestamp: new Date().toISOString(),
    error: {
      message: errorMessage,
      stack: errorStack,
    },
    entry: {
      action: entry.action,
      entityType: entry.entityType,
      // Don't log sensitive data
    },
    failureCount: auditFailureCount,
    alert: auditFailureCount >= AUDIT_FAILURE_THRESHOLD,
  }));

  // Log critical alert if threshold exceeded
  if (auditFailureCount >= AUDIT_FAILURE_THRESHOLD) {
    console.error(JSON.stringify({
      level: 'critical',
      service: 'audit-logger',
      alert: 'AUDIT_SYSTEM_DEGRADED',
      message: `Audit logging has failed ${auditFailureCount} times in the last minute`,
      timestamp: new Date().toISOString(),
    }));
  }
}

export interface AuditLogEntry {
  tenantId: string;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// BUG-009 FIX: Auth audit entry for failed attempts (no user context)
export interface AuthAuditLogEntry {
  action: 'login_failed' | 'password_reset_request';
  entityType: 'user';
  metadata: {
    email?: string;
    ip?: string;
    userAgent?: string;
    reason?: string;
  };
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      tenantId: entry.tenantId,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      oldValues: entry.oldValues ? entry.oldValues : null,
      newValues: entry.newValues ? entry.newValues : null,
      metadata: entry.metadata ? entry.metadata : null,
    });
  } catch (error) {
    // BUG-017 FIX: Structured error logging for monitoring
    logAuditError('logAudit', entry, error);
  }
}

// Helper to extract changes between old and new values
export function getChangedFields(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): { old: Record<string, unknown>; new: Record<string, unknown> } {
  const changes = {
    old: {} as Record<string, unknown>,
    new: {} as Record<string, unknown>,
  };

  for (const key of Object.keys(newValues)) {
    if (oldValues[key] !== newValues[key]) {
      changes.old[key] = oldValues[key];
      changes.new[key] = newValues[key];
    }
  }

  return changes;
}

// Sensitive fields to exclude from audit logs
const sensitiveFields = ['passwordHash', 'password', 'keyHash', 'token', 'secret'];

export function sanitizeForAudit(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...data };
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
}

// BUG-009 FIX: Log authentication events (for failed attempts without tenant context)
export async function logAuthEvent(entry: AuthAuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      tenantId: 'system', // Use 'system' for pre-auth events
      userId: 'anonymous', // No user context for failed attempts
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.metadata.email || 'unknown',
      oldValues: null,
      newValues: null,
      metadata: {
        ...entry.metadata,
        // Redact email to just show domain for privacy
        email: entry.metadata.email?.replace(/^[^@]+/, '***'),
      },
    });
  } catch (error) {
    // BUG-017 FIX: Structured error logging for monitoring
    logAuditError('logAuthEvent', entry, error);
  }
}

// BUG-009 FIX: Log successful authentication with tenant context
export async function logAuthSuccess(
  tenantId: string,
  userId: string,
  action: 'login_success' | 'logout' | 'password_reset_success',
  metadata: { ip?: string; userAgent?: string }
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      tenantId,
      userId,
      action,
      entityType: 'user',
      entityId: userId,
      oldValues: null,
      newValues: null,
      metadata,
    });
  } catch (error) {
    // BUG-017 FIX: Structured error logging for monitoring
    logAuditError('logAuthSuccess', { action, entityType: 'user' }, error);
  }
}
