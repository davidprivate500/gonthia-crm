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

// Platform settings schema
export const platformSettingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(255),
  legalName: z.string().max(255).optional(),
  registrationId: z.string().max(100).optional(),
  vatId: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  website: z.string().url().max(500).optional().or(z.literal('')),
  logoUrl: z.string().url().max(500).optional().or(z.literal('')),
  // Bank details
  bankName: z.string().max(255).optional(),
  bankAccountName: z.string().max(255).optional(),
  bankAccountNumber: z.string().max(100).optional(),
  bankRoutingNumber: z.string().max(50).optional(),
  bankSwiftCode: z.string().max(20).optional(),
  bankIban: z.string().max(50).optional(),
  // Crypto
  cryptoWalletAddress: z.string().max(255).optional(),
  cryptoNetwork: z.string().max(50).optional(),
  // Payment
  paymentInstructions: z.string().max(2000).optional(),
  // Invoice settings
  invoicePrefix: z.string().max(10).default('INV'),
  invoiceFooterText: z.string().max(2000).optional(),
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
