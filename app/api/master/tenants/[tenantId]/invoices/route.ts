import { NextRequest } from 'next/server';
import { db, tenants, invoices, invoiceLineItems, platformSettings, tenantBillingInfo } from '@/lib/db';
import { requireMasterAdmin, requireMasterAdminWithCsrf } from '@/lib/auth/middleware';
import { createInvoiceSchema, invoiceQuerySchema } from '@/validations/invoice';
import { successResponse, notFoundError, internalError, validationError, formatZodErrors, paginatedResponse, badRequestError } from '@/lib/api/response';
import { eq, desc, asc, ilike, and, sql } from 'drizzle-orm';
import { toSearchPattern } from '@/lib/search';
import { generateInvoiceNumber } from '@/lib/invoices/number';

interface RouteContext {
  params: Promise<{ tenantId: string }>;
}

// List invoices for a tenant
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { tenantId } = await context.params;

    // Verify tenant exists
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      return notFoundError('Tenant not found');
    }

    const { searchParams } = new URL(request.url);
    const query = invoiceQuerySchema.parse(Object.fromEntries(searchParams));
    const { page, pageSize, status, search, sortBy, sortOrder } = query;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [eq(invoices.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(invoices.status, status));
    }

    if (search) {
      const searchPattern = toSearchPattern(search);
      conditions.push(ilike(invoices.invoiceNumber, searchPattern));
    }

    const whereClause = and(...conditions);

    // Get total count
    const totalResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(whereClause);

    // Build order by
    const orderByMap: Record<string, typeof invoices.invoiceNumber> = {
      invoiceNumber: invoices.invoiceNumber,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      total: invoices.totalAmount,
      createdAt: invoices.createdAt,
    };
    const orderByField = orderByMap[sortBy] || invoices.createdAt;
    const orderByClause = sortOrder === 'asc' ? asc(orderByField) : desc(orderByField);

    // Get invoices with line items
    const invoiceList = await db.query.invoices.findMany({
      where: whereClause,
      with: {
        lineItems: true,
      },
      limit: pageSize,
      offset,
      orderBy: [orderByClause],
    });

    return paginatedResponse(invoiceList, totalResult[0].count, page, pageSize);
  } catch (error) {
    console.error('List invoices error:', error);
    return internalError();
  }
}

// Create a new invoice for a tenant
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireMasterAdminWithCsrf(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { tenantId } = await context.params;

    // Verify tenant exists and get billing info
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      with: {
        billingInfo: true,
      },
    });

    if (!tenant) {
      return notFoundError('Tenant not found');
    }

    // Get platform settings for issuer snapshot
    const settings = await db.query.platformSettings.findFirst();
    if (!settings) {
      return badRequestError('Platform settings must be configured before creating invoices');
    }

    const body = await request.json();
    const result = createInvoiceSchema.safeParse({ ...body, tenantId });

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { lineItems, issueImmediately, ...invoiceData } = result.data;

    // Calculate totals
    let subtotal = 0;
    for (const item of lineItems) {
      subtotal += item.quantity * item.unitPrice;
    }

    const taxRate = invoiceData.taxRate ?? 0;
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Build issuer snapshot from platform settings
    const issuerSnapshot = {
      companyName: settings.companyName,
      legalName: settings.legalName,
      registrationId: settings.registrationId,
      vatId: settings.vatId,
      address: settings.address,
      city: settings.city,
      state: settings.state,
      postalCode: settings.postalCode,
      country: settings.country,
      email: settings.email,
      phone: settings.phone,
      website: settings.website,
      logoUrl: settings.logoUrl,
      bankName: settings.bankName,
      bankAccountName: settings.bankAccountName,
      bankAccountNumber: settings.bankAccountNumber,
      bankRoutingNumber: settings.bankRoutingNumber,
      bankSwiftCode: settings.bankSwiftCode,
      bankIban: settings.bankIban,
      cryptoWalletAddress: settings.cryptoWalletAddress,
      cryptoNetwork: settings.cryptoNetwork,
      paymentInstructions: settings.paymentInstructions,
    };

    // Build client snapshot from tenant + billing info
    const clientSnapshot = {
      name: tenant.name,
      legalName: tenant.billingInfo?.legalName,
      registrationId: tenant.billingInfo?.registrationId,
      vatId: tenant.billingInfo?.vatId,
      address: tenant.billingInfo?.billingAddress,
      city: tenant.billingInfo?.billingCity,
      state: tenant.billingInfo?.billingState,
      postalCode: tenant.billingInfo?.billingPostalCode,
      country: tenant.billingInfo?.billingCountry,
      email: tenant.billingInfo?.billingEmail,
      phone: tenant.billingInfo?.billingPhone,
    };

    // Determine status
    const status = issueImmediately ? 'issued' : 'draft';
    const issueDate = invoiceData.issueDate
      ? new Date(invoiceData.issueDate)
      : (issueImmediately ? new Date() : null);

    // Calculate due date if issuing immediately
    const dueDate = invoiceData.dueDate
      ? new Date(invoiceData.dueDate)
      : (issueImmediately && issueDate
          ? new Date(issueDate.getTime() + (settings.defaultPaymentTermsDays || 30) * 24 * 60 * 60 * 1000)
          : null);

    // Create invoice with line items in a transaction
    const invoice = await db.transaction(async (tx) => {
      const [newInvoice] = await tx.insert(invoices)
        .values({
          invoiceNumber,
          tenantId,
          status,
          currency: invoiceData.currency,
          issueDate,
          dueDate,
          subtotal: subtotal.toString(),
          taxRate: taxRate.toString(),
          taxAmount: taxAmount.toString(),
          totalAmount: totalAmount.toString(),
          notes: invoiceData.notes,
          internalNotes: invoiceData.internalNotes,
          issuerSnapshot,
          clientSnapshot,
          createdById: auth.userId,
        })
        .returning();

      // Insert line items
      const lineItemsWithInvoiceId = lineItems.map((item, index) => ({
        invoiceId: newInvoice.id,
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        lineTotal: (item.quantity * item.unitPrice).toString(),
        sortOrder: index,
      }));

      await tx.insert(invoiceLineItems)
        .values(lineItemsWithInvoiceId);

      // Return with line items
      return {
        ...newInvoice,
        lineItems: lineItemsWithInvoiceId,
      };
    });

    return successResponse(invoice, 201);
  } catch (error) {
    console.error('Create invoice error:', error);
    return internalError();
  }
}
