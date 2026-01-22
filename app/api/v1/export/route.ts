import { NextRequest } from 'next/server';
import { db, contacts, companies, deals } from '@/lib/db';
import { requireOwner } from '@/lib/auth/middleware';
import { canExportData } from '@/lib/auth/session';
import { forbiddenError, validationError, internalError } from '@/lib/api/response';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';

const exportSchema = z.object({
  entityType: z.enum(['contacts', 'companies', 'deals']),
  format: z.enum(['csv', 'json']).default('csv'),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if (auth instanceof Response) {
      return auth;
    }

    if (!canExportData(auth.role)) {
      return forbiddenError('Only organization owners can export data');
    }

    if (!auth.tenantId) {
      return forbiddenError('Tenant access required');
    }

    const { searchParams } = new URL(request.url);
    const result = exportSchema.safeParse(Object.fromEntries(searchParams));

    if (!result.success) {
      return validationError(
        Object.fromEntries(
          result.error.issues.map((e) => [e.path.map(String).join('.') || '_root', [e.message]])
        )
      );
    }

    const { entityType, format } = result.data;
    let data: Record<string, unknown>[];
    let filename: string;

    switch (entityType) {
      case 'contacts':
        data = await db.query.contacts.findMany({
          where: and(
            eq(contacts.tenantId, auth.tenantId),
            isNull(contacts.deletedAt)
          ),
          with: {
            company: {
              columns: { name: true },
            },
            owner: {
              columns: { email: true },
            },
          },
        });
        filename = `contacts-export-${Date.now()}`;
        break;

      case 'companies':
        data = await db.query.companies.findMany({
          where: and(
            eq(companies.tenantId, auth.tenantId),
            isNull(companies.deletedAt)
          ),
          with: {
            owner: {
              columns: { email: true },
            },
          },
        });
        filename = `companies-export-${Date.now()}`;
        break;

      case 'deals':
        data = await db.query.deals.findMany({
          where: and(
            eq(deals.tenantId, auth.tenantId),
            isNull(deals.deletedAt)
          ),
          with: {
            stage: {
              columns: { name: true },
            },
            contact: {
              columns: { firstName: true, lastName: true, email: true },
            },
            company: {
              columns: { name: true },
            },
            owner: {
              columns: { email: true },
            },
          },
        });
        filename = `deals-export-${Date.now()}`;
        break;

      default:
        return validationError({ entityType: ['Invalid entity type'] });
    }

    if (format === 'json') {
      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}.json"`,
        },
      });
    }

    // CSV format
    if (data.length === 0) {
      return new Response('', {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    }

    // Flatten nested objects for CSV
    const flattenObject = (obj: Record<string, unknown>, prefix = ''): Record<string, string> => {
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}_${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
        } else if (value instanceof Date) {
          result[newKey] = value.toISOString();
        } else if (value !== null && value !== undefined) {
          result[newKey] = String(value);
        } else {
          result[newKey] = '';
        }
      }
      return result;
    };

    const flatData = data.map(item => flattenObject(item));
    const headers = [...new Set(flatData.flatMap(Object.keys))];

    // Escape CSV values
    const escapeCSV = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvRows = [
      headers.map(escapeCSV).join(','),
      ...flatData.map(row => headers.map(h => escapeCSV(row[h] || '')).join(',')),
    ];

    return new Response(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return internalError();
  }
}
