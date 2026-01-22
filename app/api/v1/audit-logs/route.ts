import { NextRequest } from 'next/server';
import { db, auditLogs } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';
import { auditLogQuerySchema } from '@/validations/audit';
import { canViewAuditLog } from '@/lib/auth/session';
import { validationError, forbiddenError, internalError, formatZodErrors, paginatedResponse } from '@/lib/api/response';
import { eq, and, count, gte, lte } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    if (!canViewAuditLog(auth.role)) {
      return forbiddenError('You do not have permission to view audit logs');
    }

    const { searchParams } = new URL(request.url);
    const result = auditLogQuerySchema.safeParse(Object.fromEntries(searchParams));

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { page, pageSize, entityType, entityId, action, userId, dateFrom, dateTo } = result.data;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(auditLogs.tenantId, auth.tenantId)];

    if (entityType) {
      conditions.push(eq(auditLogs.entityType, entityType));
    }

    if (entityId) {
      conditions.push(eq(auditLogs.entityId, entityId));
    }

    if (action) {
      conditions.push(eq(auditLogs.action, action));
    }

    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }

    if (dateFrom) {
      conditions.push(gte(auditLogs.createdAt, dateFrom));
    }

    if (dateTo) {
      conditions.push(lte(auditLogs.createdAt, dateTo));
    }

    const [logList, totalResult] = await Promise.all([
      db.query.auditLogs.findMany({
        where: and(...conditions),
        with: {
          user: {
            columns: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        limit: pageSize,
        offset,
        orderBy: (auditLogs, { desc }) => [desc(auditLogs.createdAt)],
      }),
      db.select({ count: count() })
        .from(auditLogs)
        .where(and(...conditions)),
    ]);

    return paginatedResponse(logList, totalResult[0].count, page, pageSize);
  } catch (error) {
    console.error('List audit logs error:', error);
    return internalError();
  }
}
