import { NextRequest } from 'next/server';
import { db, invoices, invoiceLineItems } from '@/lib/db';
import { requireMasterAdmin, requireMasterAdminWithCsrf } from '@/lib/auth/middleware';
import { updateInvoiceSchema, updateInvoiceStatusSchema } from '@/validations/invoice';
import { successResponse, notFoundError, internalError, validationError, formatZodErrors, badRequestError } from '@/lib/api/response';
import { eq } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{ invoiceId: string }>;
}

// Get invoice details
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { invoiceId } = await context.params;

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
      with: {
        lineItems: {
          orderBy: (items, { asc }) => [asc(items.position)],
        },
        tenant: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invoice) {
      return notFoundError('Invoice not found');
    }

    return successResponse(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    return internalError();
  }
}

// Update invoice (only drafts can be fully edited)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireMasterAdminWithCsrf(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { invoiceId } = await context.params;

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
      with: {
        lineItems: true,
      },
    });

    if (!invoice) {
      return notFoundError('Invoice not found');
    }

    const body = await request.json();

    // Check if this is a status-only update
    if (body.status && Object.keys(body).length === 1) {
      const statusResult = updateInvoiceStatusSchema.safeParse(body);
      if (!statusResult.success) {
        return validationError(formatZodErrors(statusResult.error));
      }

      const { status } = statusResult.data;

      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        draft: ['issued', 'void'],
        issued: ['paid', 'void'],
        paid: ['void'], // Can void a paid invoice (refund scenario)
        void: [], // Cannot transition from void
      };

      if (!validTransitions[invoice.status]?.includes(status)) {
        return badRequestError(`Cannot transition from ${invoice.status} to ${status}`);
      }

      // Handle issue date when transitioning to issued
      const updates: Record<string, unknown> = {
        status,
        updatedAt: new Date(),
      };

      if (status === 'issued' && !invoice.issueDate) {
        updates.issueDate = new Date();
      }

      if (status === 'paid') {
        updates.paidAt = new Date();
      }

      if (status === 'void') {
        updates.voidedAt = new Date();
      }

      const [updated] = await db.update(invoices)
        .set(updates)
        .where(eq(invoices.id, invoiceId))
        .returning();

      return successResponse(updated);
    }

    // Full update - only allowed for drafts
    if (invoice.status !== 'draft') {
      return badRequestError('Only draft invoices can be edited');
    }

    const result = updateInvoiceSchema.safeParse(body);
    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { lineItems, ...updateData } = result.data;

    // Calculate new totals if line items provided
    let subtotal = 0;
    if (lineItems) {
      for (const item of lineItems) {
        subtotal += item.quantity * item.unitPrice;
      }
    } else {
      // Keep existing subtotal
      subtotal = parseFloat(invoice.subtotal);
    }

    const taxRate = updateData.taxRate ?? parseFloat(invoice.taxRate || '0');
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    // Prepare update data with proper date conversions
    const updateValues: Record<string, unknown> = {
      taxRate: taxRate.toString(),
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      total: totalAmount.toString(),
      updatedAt: new Date(),
    };

    // Only set fields that were provided
    if (updateData.currency !== undefined) updateValues.currency = updateData.currency;
    if (updateData.issueDate !== undefined) updateValues.issueDate = new Date(updateData.issueDate);
    if (updateData.dueDate !== undefined) updateValues.dueDate = new Date(updateData.dueDate);
    if (updateData.notes !== undefined) updateValues.notes = updateData.notes;
    if (updateData.internalNotes !== undefined) updateValues.internalNotes = updateData.internalNotes;

    // Update in transaction
    const updatedInvoice = await db.transaction(async (tx) => {
      // Update invoice
      const [updated] = await tx.update(invoices)
        .set(updateValues)
        .where(eq(invoices.id, invoiceId))
        .returning();

      // Update line items if provided
      if (lineItems) {
        // Delete existing
        await tx.delete(invoiceLineItems)
          .where(eq(invoiceLineItems.invoiceId, invoiceId));

        // Insert new
        const lineItemsWithInvoiceId = lineItems.map((item, index) => ({
          invoiceId,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          amount: (item.quantity * item.unitPrice).toString(),
          position: index,
        }));

        await tx.insert(invoiceLineItems)
          .values(lineItemsWithInvoiceId);
      }

      // Fetch updated with line items
      return tx.query.invoices.findFirst({
        where: eq(invoices.id, invoiceId),
        with: {
          lineItems: {
            orderBy: (items, { asc }) => [asc(items.position)],
          },
        },
      });
    });

    return successResponse(updatedInvoice);
  } catch (error) {
    console.error('Update invoice error:', error);
    return internalError();
  }
}

// Delete invoice (only drafts)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireMasterAdminWithCsrf(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { invoiceId } = await context.params;

    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
    });

    if (!invoice) {
      return notFoundError('Invoice not found');
    }

    if (invoice.status !== 'draft') {
      return badRequestError('Only draft invoices can be deleted');
    }

    // Delete invoice (line items cascade)
    await db.delete(invoices)
      .where(eq(invoices.id, invoiceId));

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('Delete invoice error:', error);
    return internalError();
  }
}
