/**
 * Chunked Generator for Growth-Curve Mode
 *
 * A simplified chunked generator for the original growth-curve mode.
 * Uses similar patterns to ChunkedMonthlyPlanGenerator but with simpler data generation.
 */

import { db } from '@/lib/db';
import { demoGenerationJobs } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { DemoGenerator } from './generator';

// Re-export the original generator for now - growth-curve mode typically
// generates less data and is less likely to timeout
export class ChunkedGenerator {
  private jobId: string;

  constructor(jobId: string) {
    this.jobId = jobId;
  }

  async continueGeneration(): Promise<void> {
    // Load job
    const job = await db.query.demoGenerationJobs.findFirst({
      where: eq(demoGenerationJobs.id, this.jobId),
    });

    if (!job || job.status !== 'running') {
      console.log(`[ChunkedGen] Job ${this.jobId} is not running`);
      return;
    }

    // For growth-curve mode, we use the original generator
    // It's typically fast enough for the data volumes used
    const generator = new DemoGenerator(this.jobId, job.config as any, job.seed);

    try {
      await generator.generate();
    } catch (error) {
      console.error(`[ChunkedGen] Generation failed for ${this.jobId}:`, error);
    }
  }
}
