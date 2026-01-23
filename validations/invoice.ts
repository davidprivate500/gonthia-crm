import { z } from 'zod';

// Invoice line item schema
export const invoiceLineItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
});

// Create invoice schema
export const createInvoiceSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('USD'),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
  lineItems: z.array(invoiceLineItemSchema).min(1, 'At least one line item is required'),
  // Optionally issue immediately (skip draft)
  issueImmediately: z.boolean().default(false),
});

// Update invoice schema (for drafts)
export const updateInvoiceSchema = z.object({
  currency: z.string().length(3).optional(),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  taxRate: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  lineItems: z.array(invoiceLineItemSchema).min(1).optional(),
});

// Update invoice status schema
export const updateInvoiceStatusSchema = z.object({
  status: z.enum(['issued', 'paid', 'void']),
});

// Query schema for listing invoices
export const invoiceQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['draft', 'issued', 'paid', 'void', 'overdue']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['invoiceNumber', 'issueDate', 'dueDate', 'total', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Helper to allow empty string or valid value for optional fields
const optionalString = (maxLength: number) =>
  z.string().max(maxLength).optional().or(z.literal(''));

const optionalEmail = () =>
  z.string().email().max(255).optional().or(z.literal(''));

const optionalUrl = (maxLength: number) =>
  z.string().url().max(maxLength).optional().or(z.literal(''));

// Platform settings schema
export const platformSettingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(255),
  legalName: optionalString(255),
  registrationId: optionalString(100),
  vatId: optionalString(50),
  address: optionalString(500),
  city: optionalString(100),
  state: optionalString(100),
  postalCode: optionalString(20),
  country: optionalString(100),
  email: optionalEmail(),
  phone: optionalString(50),
  website: optionalUrl(500),
  logoUrl: optionalUrl(500),
  // Bank details
  bankName: optionalString(255),
  bankAccountName: optionalString(255),
  bankAccountNumber: optionalString(100),
  bankRoutingNumber: optionalString(50),
  bankSwiftCode: optionalString(20),
  bankIban: optionalString(50),
  // Crypto
  cryptoWalletAddress: optionalString(255),
  cryptoNetwork: optionalString(50),
  // Payment
  paymentInstructions: optionalString(2000),
  // Invoice settings
  invoicePrefix: z.string().max(10).default('INV'),
  invoiceFooterText: optionalString(2000),
  defaultCurrency: z.string().length(3).default('USD'),
  defaultPaymentTermsDays: z.number().int().min(0).max(365).default(30),
});

// Tenant billing info schema
export const tenantBillingInfoSchema = z.object({
  legalName: z.string().max(255).optional(),
  registrationId: z.string().max(100).optional(),
  vatId: z.string().max(50).optional(),
  billingAddress: z.string().max(500).optional(),
  billingCity: z.string().max(100).optional(),
  billingState: z.string().max(100).optional(),
  billingPostalCode: z.string().max(20).optional(),
  billingCountry: z.string().max(100).optional(),
  billingEmail: z.string().email().max(255).optional().or(z.literal('')),
  billingPhone: z.string().max(50).optional(),
});

// Tenant query schema
export const tenantQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;
export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>;
export type TenantBillingInfoInput = z.infer<typeof tenantBillingInfoSchema>;
