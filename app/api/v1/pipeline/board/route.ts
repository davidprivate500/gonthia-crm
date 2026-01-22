import { NextRequest } from 'next/server';
import { db, deals, pipelineStages } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';
import { successResponse, internalError } from '@/lib/api/response';
import { eq, and, isNull, asc } from 'drizzle-orm';

// Get the complete pipeline board view (stages with deals)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get('ownerId');

    // Get all stages with their deals
    const stages = await db.query.pipelineStages.findMany({
      where: and(
        eq(pipelineStages.tenantId, auth.tenantId),
        isNull(pipelineStages.deletedAt)
      ),
      orderBy: [asc(pipelineStages.position)],
    });

    // Build deal conditions
    const dealConditions = [
      eq(deals.tenantId, auth.tenantId),
      isNull(deals.deletedAt),
    ];

    if (ownerId) {
      dealConditions.push(eq(deals.ownerId, ownerId));
    }

    // Get all deals with relations
    const allDeals = await db.query.deals.findMany({
      where: and(...dealConditions),
      with: {
        contact: {
          columns: { id: true, firstName: true, lastName: true },
        },
        company: {
          columns: { id: true, name: true },
        },
        owner: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [asc(deals.position)],
    });

    // Group deals by stage
    const board = stages.map(stage => ({
      ...stage,
      deals: allDeals.filter(deal => deal.stageId === stage.id),
    }));

    // Calculate totals
    const totalValue = allDeals.reduce((sum, deal) => {
      return sum + (deal.value ? parseFloat(deal.value) : 0);
    }, 0);

    const totalDeals = allDeals.length;

    return successResponse({
      board,
      summary: {
        totalDeals,
        totalValue,
        stageCount: stages.length,
      },
    });
  } catch (error) {
    console.error('Get pipeline board error:', error);
    return internalError();
  }
}
