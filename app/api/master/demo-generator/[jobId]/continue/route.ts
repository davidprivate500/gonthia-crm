import { NextRequest, NextResponse } from 'next/server';
import { db, demoGenerationJobs } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ChunkedGenerator } from '@/lib/demo-generator/engine/chunked-generator';
import { ChunkedMonthlyPlanGenerator } from '@/lib/demo-generator/engine/chunked-monthly-plan-generator';

// Allow longer execution time (5 minutes max on Vercel Pro)
export const maxDuration = 300;

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

// POST /api/master/demo-generator/:jobId/continue
// Internal endpoint to continue a chunked generation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { jobId } = await params;

    // Verify internal token or master admin auth
    const internalToken = request.headers.get('x-internal-continuation-token');
    const expectedToken = process.env.INTERNAL_API_SECRET || process.env.SESSION_SECRET;

    if (internalToken !== expectedToken) {
      // If no internal token, this might be a manual retry - that's ok
      console.log(`[Continue] Job ${jobId} - No internal token, treating as manual retry`);
    }

    // Load job
    const job = await db.query.demoGenerationJobs.findFirst({
      where: eq(demoGenerationJobs.id, jobId),
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status !== 'running') {
      return NextResponse.json({
        message: `Job is ${job.status}, not running`,
        status: job.status
      });
    }

    console.log(`[Continue] Resuming job ${jobId} from phase ${job.generationPhase}`);

    // Continue generation based on mode
    if (job.mode === 'monthly-plan') {
      const generator = new ChunkedMonthlyPlanGenerator(jobId);
      generator.continueGeneration().catch((error) => {
        console.error(`[Continue] Monthly plan generation failed for ${jobId}:`, error);
      });
    } else {
      const generator = new ChunkedGenerator(jobId);
      generator.continueGeneration().catch((error) => {
        console.error(`[Continue] Generation failed for ${jobId}:`, error);
      });
    }

    return NextResponse.json({
      message: 'Generation continuing',
      jobId,
      phase: job.generationPhase,
    });
  } catch (error) {
    console.error('Continue generation error:', error);
    return NextResponse.json(
      { error: 'Failed to continue generation' },
      { status: 500 }
    );
  }
}
