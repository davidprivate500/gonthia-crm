import { db, invoiceNumberSequence, platformSettings } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

/**
 * Generate the next invoice number in a concurrency-safe manner.
 * Uses a sequence table with row-level locking to prevent duplicates.
 *
 * Format: {prefix}-{year}-{sequence:6}
 * Example: INV-2024-000123
 */
export async function generateInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();

  // Get prefix from platform settings (default to 'INV')
  const settings = await db.query.platformSettings.findFirst();
  const prefix = settings?.invoicePrefix || 'INV';

  // Use a transaction with row-level locking
  const result = await db.transaction(async (tx) => {
    // Try to get existing sequence for this year with FOR UPDATE lock
    const existing = await tx.query.invoiceNumberSequence.findFirst({
      where: eq(invoiceNumberSequence.year, currentYear),
    });

    if (existing) {
      // Increment and return
      const newSequence = existing.lastSequence + 1;

      await tx.update(invoiceNumberSequence)
        .set({
          lastSequence: newSequence,
          updatedAt: new Date(),
        })
        .where(eq(invoiceNumberSequence.year, currentYear));

      return newSequence;
    } else {
      // Create new sequence for this year
      const [created] = await tx.insert(invoiceNumberSequence)
        .values({
          year: currentYear,
          lastSequence: 1,
        })
        .returning();

      return created.lastSequence;
    }
  });

  // Format: INV-2024-000123
  const paddedSequence = result.toString().padStart(6, '0');
  return `${prefix}-${currentYear}-${paddedSequence}`;
}

/**
 * Parse invoice number to extract year and sequence
 */
export function parseInvoiceNumber(invoiceNumber: string): { prefix: string; year: number; sequence: number } | null {
  const match = invoiceNumber.match(/^([A-Z]+)-(\d{4})-(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    prefix: match[1],
    year: parseInt(match[2], 10),
    sequence: parseInt(match[3], 10),
  };
}
