import { db, auditLogs } from '@/lib/db';

export type AuditAction = 'create' | 'update' | 'delete';

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
    // Log error but don't throw - audit logging shouldn't break the main operation
    console.error('Failed to write audit log:', error);
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
