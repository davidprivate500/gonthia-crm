import { NextRequest } from 'next/server';
import { db, importJobs } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/middleware';
import { successResponse, notFoundError, internalError } from '@/lib/api/response';
import { eq, and } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { jobId } = await params;

    const job = await db.query.importJobs.findFirst({
      where: and(
        eq(importJobs.id, jobId),
        eq(importJobs.tenantId, auth.tenantId)
      ),
      with: {
        createdBy: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!job) {
      return notFoundError('Import job not found');
    }

    return successResponse({ job });
  } catch (error) {
    console.error('Get import job error:', error);
    return internalError();
  }
}
