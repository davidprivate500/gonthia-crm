import { NextRequest } from 'next/server';
import { db, tenants, users, contacts, deals, invoices } from '@/lib/db';
import { requireMasterAdmin } from '@/lib/auth/middleware';
import { tenantQuerySchema } from '@/validations/invoice';
import { successResponse, internalError, paginatedResponse } from '@/lib/api/response';
import { ilike, count, sql, desc, asc } from 'drizzle-orm';
import { toSearchPattern } from '@/lib/search';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const query = tenantQuerySchema.parse(Object.fromEntries(searchParams));
    const { page, pageSize, search, sortBy, sortOrder } = query;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [];
    if (search) {
      const searchPattern = toSearchPattern(search);
      conditions.push(ilike(tenants.name, searchPattern));
    }

    // Get tenants with aggregated stats
    const whereClause = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

    // Get total count
    const totalResult = await db.select({ count: count() })
      .from(tenants)
      .where(conditions.length > 0 ? ilike(tenants.name, toSearchPattern(search || '')) : undefined);

    // Get tenants with stats
    const orderByClause = sortBy === 'name'
      ? (sortOrder === 'asc' ? asc(tenants.name) : desc(tenants.name))
      : (sortOrder === 'asc' ? asc(tenants.createdAt) : desc(tenants.createdAt));

    const tenantList = await db.query.tenants.findMany({
      where: conditions.length > 0 ? ilike(tenants.name, toSearchPattern(search || '')) : undefined,
      limit: pageSize,
      offset,
      orderBy: [orderByClause],
    });

    // Get stats for each tenant
    const tenantsWithStats = await Promise.all(
      tenantList.map(async (tenant) => {
        const [userCount, contactCount, dealCount, invoiceCount] = await Promise.all([
          db.select({ count: count() }).from(users).where(sql`${users.tenantId} = ${tenant.id}`),
          db.select({ count: count() }).from(contacts).where(sql`${contacts.tenantId} = ${tenant.id}`),
          db.select({ count: count() }).from(deals).where(sql`${deals.tenantId} = ${tenant.id}`),
          db.select({ count: count() }).from(invoices).where(sql`${invoices.tenantId} = ${tenant.id}`),
        ]);

        return {
          ...tenant,
          stats: {
            users: userCount[0].count,
            contacts: contactCount[0].count,
            deals: dealCount[0].count,
            invoices: invoiceCount[0].count,
          },
        };
      })
    );

    return paginatedResponse(tenantsWithStats, totalResult[0].count, page, pageSize);
  } catch (error) {
    console.error('List tenants error:', error);
    return internalError();
  }
}
