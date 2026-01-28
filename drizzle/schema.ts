import { pgTable, uuid, varchar, timestamp, text, integer, boolean, decimal, index, pgEnum, json, type AnyPgColumn, uniqueIndex, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'member', 'readonly']);
export const contactStatusEnum = pgEnum('contact_status', ['lead', 'prospect', 'customer', 'churned', 'other']);
export const activityTypeEnum = pgEnum('activity_type', ['note', 'call', 'email', 'meeting', 'task']);
// BUG-009 FIX: Extended audit action enum to include auth events
export const auditActionEnum = pgEnum('audit_action', [
  'create', 'update', 'delete',
  'login_success', 'login_failed', 'logout',
  'password_reset_request', 'password_reset_success',
  'impersonation_start', 'impersonation_end'
]);
export const importStatusEnum = pgEnum('import_status', ['pending', 'processing', 'completed', 'failed']);
// Invoice status enum
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'issued', 'paid', 'void', 'overdue']);
// Demo generation job status enum
export const demoJobStatusEnum = pgEnum('demo_job_status', ['pending', 'running', 'completed', 'failed']);

// Tenants table
export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  // tenantId is nullable for master admins (platform-level users)
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').notNull().default('member'),
  // Master admin flag - platform-level admin with cross-tenant access
  isMasterAdmin: boolean('is_master_admin').notNull().default(false),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  invitedById: uuid('invited_by_id').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  inviteAcceptedAt: timestamp('invite_accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_users_tenant_id').on(table.tenantId),
  index('idx_users_email').on(table.email),
  index('idx_users_deleted_at').on(table.deletedAt),
  index('idx_users_is_master_admin').on(table.isMasterAdmin),
]);

// Password reset tokens
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(), // SHA-256 hash
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_password_reset_tokens_hash').on(table.tokenHash),
  index('idx_password_reset_tokens_user_id').on(table.userId),
]);

// Tags table
export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  color: varchar('color', { length: 7 }).notNull().default('#6366f1'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_tags_tenant_id').on(table.tenantId),
  index('idx_tags_deleted_at').on(table.deletedAt),
]);

// Companies table
export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }),
  industry: varchar('industry', { length: 100 }),
  size: varchar('size', { length: 20 }), // 1-10, 11-50, etc.
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  address: varchar('address', { length: 500 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  country: varchar('country', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  phone: varchar('phone', { length: 50 }),
  website: varchar('website', { length: 500 }),
  notes: text('notes'),
  // Demo provenance fields
  demoGenerated: boolean('demo_generated').default(false),
  demoJobId: uuid('demo_job_id'),
  demoSourceMonth: varchar('demo_source_month', { length: 7 }), // YYYY-MM format
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_companies_tenant_id').on(table.tenantId),
  index('idx_companies_owner_id').on(table.ownerId),
  index('idx_companies_deleted_at').on(table.deletedAt),
  index('idx_companies_demo_generated').on(table.tenantId, table.demoGenerated),
  index('idx_companies_demo_job').on(table.demoJobId),
]);

// Contacts table
export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  status: contactStatusEnum('status').notNull().default('lead'),
  // Demo provenance fields
  demoGenerated: boolean('demo_generated').default(false),
  demoJobId: uuid('demo_job_id'),
  demoSourceMonth: varchar('demo_source_month', { length: 7 }), // YYYY-MM format
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_contacts_tenant_id').on(table.tenantId),
  index('idx_contacts_company_id').on(table.companyId),
  index('idx_contacts_owner_id').on(table.ownerId),
  index('idx_contacts_deleted_at').on(table.deletedAt),
  index('idx_contacts_email').on(table.email),
  index('idx_contacts_status').on(table.status),
  index('idx_contacts_demo_generated').on(table.tenantId, table.demoGenerated),
  index('idx_contacts_demo_job').on(table.demoJobId),
]);

// Contact tags junction table
export const contactTags = pgTable('contact_tags', {
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  index('idx_contact_tags_contact_id').on(table.contactId),
  index('idx_contact_tags_tag_id').on(table.tagId),
]);

// Pipeline stages table
export const pipelineStages = pgTable('pipeline_stages', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 7 }).default('#6366f1'),
  position: integer('position').notNull(),
  isWon: boolean('is_won').notNull().default(false),
  isLost: boolean('is_lost').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_pipeline_stages_tenant_id').on(table.tenantId),
  index('idx_pipeline_stages_position').on(table.position),
  index('idx_pipeline_stages_deleted_at').on(table.deletedAt),
]);

// Deals table
export const deals = pgTable('deals', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  value: decimal('value', { precision: 15, scale: 2 }),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  stageId: uuid('stage_id').notNull().references(() => pipelineStages.id, { onDelete: 'restrict' }),
  position: integer('position').notNull().default(0),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
  probability: integer('probability'),
  notes: text('notes'),
  // Demo provenance fields
  demoGenerated: boolean('demo_generated').default(false),
  demoJobId: uuid('demo_job_id'),
  demoSourceMonth: varchar('demo_source_month', { length: 7 }), // YYYY-MM format
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_deals_tenant_id').on(table.tenantId),
  index('idx_deals_stage_id').on(table.stageId),
  index('idx_deals_owner_id').on(table.ownerId),
  index('idx_deals_contact_id').on(table.contactId),
  index('idx_deals_company_id').on(table.companyId),
  index('idx_deals_deleted_at').on(table.deletedAt),
  index('idx_deals_position').on(table.stageId, table.position),
  index('idx_deals_demo_generated').on(table.tenantId, table.demoGenerated),
  index('idx_deals_demo_job').on(table.demoJobId),
]);

// Activities table
export const activities = pgTable('activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  type: activityTypeEnum('type').notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  description: text('description'),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),
  // Demo provenance fields
  demoGenerated: boolean('demo_generated').default(false),
  demoJobId: uuid('demo_job_id'),
  demoSourceMonth: varchar('demo_source_month', { length: 7 }), // YYYY-MM format
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_activities_tenant_id').on(table.tenantId),
  index('idx_activities_contact_id').on(table.contactId),
  index('idx_activities_company_id').on(table.companyId),
  index('idx_activities_deal_id').on(table.dealId),
  index('idx_activities_created_by_id').on(table.createdById),
  index('idx_activities_scheduled_at').on(table.scheduledAt),
  index('idx_activities_deleted_at').on(table.deletedAt),
  index('idx_activities_demo_generated').on(table.tenantId, table.demoGenerated),
  index('idx_activities_demo_job').on(table.demoJobId),
]);

// API Keys table
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  keyHash: varchar('key_hash', { length: 64 }).notNull(), // SHA-256 hash
  keyPrefix: varchar('key_prefix', { length: 8 }).notNull(), // First 8 chars for display
  createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_api_keys_tenant_id').on(table.tenantId),
  index('idx_api_keys_key_hash').on(table.keyHash),
  index('idx_api_keys_revoked_at').on(table.revokedAt),
]);

// Audit logs table
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: auditActionEnum('action').notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  oldValues: json('old_values'),
  newValues: json('new_values'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_audit_logs_tenant_id').on(table.tenantId),
  index('idx_audit_logs_user_id').on(table.userId),
  index('idx_audit_logs_entity').on(table.entityType, table.entityId),
  index('idx_audit_logs_created_at').on(table.createdAt),
  // BUG-021 FIX: Add index on action column for filtering by action type
  index('idx_audit_logs_action').on(table.action),
]);

// Import jobs table
export const importJobs = pgTable('import_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // contacts, companies, deals
  fileName: varchar('file_name', { length: 255 }).notNull(),
  status: importStatusEnum('status').notNull().default('pending'),
  totalRows: integer('total_rows'),
  processedRows: integer('processed_rows').default(0),
  successfulRows: integer('successful_rows').default(0),
  failedRows: integer('failed_rows').default(0),
  errorReport: json('error_report'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  index('idx_import_jobs_tenant_id').on(table.tenantId),
  index('idx_import_jobs_created_by_id').on(table.createdById),
  index('idx_import_jobs_status').on(table.status),
]);

// ============================================================================
// PLATFORM & BILLING TABLES
// ============================================================================

// Platform settings table (singleton) - stores issuer/platform billing info
export const platformSettings = pgTable('platform_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Issuer (platform) company details
  companyName: varchar('company_name', { length: 255 }).notNull(),
  legalName: varchar('legal_name', { length: 255 }),
  registrationId: varchar('registration_id', { length: 100 }), // Company reg number
  vatId: varchar('vat_id', { length: 50 }), // VAT/Tax ID
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  country: varchar('country', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  website: varchar('website', { length: 500 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  // Bank/payment details
  bankName: varchar('bank_name', { length: 255 }),
  bankAccountName: varchar('bank_account_name', { length: 255 }),
  bankAccountNumber: varchar('bank_account_number', { length: 100 }),
  bankRoutingNumber: varchar('bank_routing_number', { length: 50 }),
  bankSwiftCode: varchar('bank_swift_code', { length: 20 }),
  bankIban: varchar('bank_iban', { length: 50 }),
  // Crypto payment (optional)
  cryptoWalletAddress: varchar('crypto_wallet_address', { length: 255 }),
  cryptoNetwork: varchar('crypto_network', { length: 50 }),
  // Additional payment instructions
  paymentInstructions: text('payment_instructions'),
  // Invoice settings
  invoicePrefix: varchar('invoice_prefix', { length: 10 }).notNull().default('INV'),
  invoiceFooterText: text('invoice_footer_text'),
  defaultCurrency: varchar('default_currency', { length: 3 }).notNull().default('USD'),
  defaultPaymentTermsDays: integer('default_payment_terms_days').notNull().default(30),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tenant billing info - billing details for each tenant (client)
export const tenantBillingInfo = pgTable('tenant_billing_info', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }).unique(),
  // Client billing details
  legalName: varchar('legal_name', { length: 255 }),
  registrationId: varchar('registration_id', { length: 100 }), // Company reg number
  vatId: varchar('vat_id', { length: 50 }), // VAT/Tax ID
  billingAddress: text('billing_address'),
  billingCity: varchar('billing_city', { length: 100 }),
  billingState: varchar('billing_state', { length: 100 }),
  billingPostalCode: varchar('billing_postal_code', { length: 20 }),
  billingCountry: varchar('billing_country', { length: 100 }),
  billingEmail: varchar('billing_email', { length: 255 }),
  billingPhone: varchar('billing_phone', { length: 50 }),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_tenant_billing_info_tenant_id').on(table.tenantId),
]);

// Invoice number sequence - for generating unique invoice numbers
export const invoiceNumberSequence = pgTable('invoice_number_sequence', {
  id: uuid('id').defaultRandom().primaryKey(),
  year: integer('year').notNull(),
  lastNumber: integer('last_number').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_invoice_number_sequence_year').on(table.year),
]);

// Invoices table
export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Invoice number (e.g., INV-2024-000123)
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(),
  // Tenant (client) this invoice is for
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'restrict' }),
  // Status tracking
  status: invoiceStatusEnum('status').notNull().default('draft'),
  // Dates
  issueDate: timestamp('issue_date', { withTimezone: true }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  // Currency and amounts (calculated server-side)
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull().default('0'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }), // e.g., 20.00 for 20%
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  total: decimal('total', { precision: 15, scale: 2 }).notNull().default('0'),
  // Snapshot of issuer details at time of invoice creation
  issuerSnapshot: json('issuer_snapshot'),
  // Snapshot of client details at time of invoice creation
  clientSnapshot: json('client_snapshot'),
  // Notes visible on invoice
  notes: text('notes'),
  // Internal notes (not visible on invoice)
  internalNotes: text('internal_notes'),
  // Audit
  createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  issuedById: uuid('issued_by_id').references(() => users.id, { onDelete: 'set null' }),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_invoices_tenant_id').on(table.tenantId),
  index('idx_invoices_status').on(table.status),
  index('idx_invoices_issue_date').on(table.issueDate),
  index('idx_invoices_due_date').on(table.dueDate),
  index('idx_invoices_created_by_id').on(table.createdById),
]);

// Invoice line items
export const invoiceLineItems = pgTable('invoice_line_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  // Line item details
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(), // quantity * unitPrice
  // Position for ordering
  position: integer('position').notNull().default(0),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_invoice_line_items_invoice_id').on(table.invoiceId),
  index('idx_invoice_line_items_position').on(table.invoiceId, table.position),
]);

// ============================================================================
// DEMO GENERATOR TABLES
// ============================================================================

// Demo generation mode enum
export const demoGenerationModeEnum = pgEnum('demo_generation_mode', ['growth-curve', 'monthly-plan']);

// Demo patch enums
export const demoPatchModeEnum = pgEnum('demo_patch_mode', ['additive', 'reconcile', 'metrics-only']);
export const demoPatchPlanTypeEnum = pgEnum('demo_patch_plan_type', ['targets', 'deltas']);

// Demo generation jobs - tracks each demo tenant generation
export const demoGenerationJobs = pgTable('demo_generation_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Creator (master admin who initiated) - nullable to allow job records to survive user deletion
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  // Job status
  status: demoJobStatusEnum('status').notNull().default('pending'),
  // Generation mode: growth-curve (original) or monthly-plan (new)
  mode: demoGenerationModeEnum('mode').notNull().default('growth-curve'),
  // Full configuration used for generation (JSON)
  config: json('config').notNull(),
  // Seed for deterministic generation
  seed: varchar('seed', { length: 64 }).notNull(),
  // Monthly plan data (JSON) - only populated when mode is 'monthly-plan'
  monthlyPlanJson: json('monthly_plan_json'),
  // Plan schema version for backwards compatibility
  planVersion: varchar('plan_version', { length: 20 }),
  // Tolerance config used for verification
  toleranceConfig: json('tolerance_config'),
  // Result: the created tenant
  createdTenantId: uuid('created_tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  // Progress tracking
  progress: integer('progress').notNull().default(0), // 0-100
  currentStep: varchar('current_step', { length: 100 }),
  // Generation phase for chunked/resumable execution
  generationPhase: varchar('generation_phase', { length: 50 }).default('init'),
  // Detailed state for resumable generation (batch progress, created IDs, etc.)
  generationState: json('generation_state'),
  logs: json('logs').default([]),
  // Metrics (actual generated counts)
  metrics: json('metrics'),
  // KPI Verification report (JSON) - populated after generation
  verificationReport: json('verification_report'),
  // Quick access: did verification pass?
  verificationPassed: boolean('verification_passed'),
  // Error info (if failed)
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),
  // Timestamps
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_demo_jobs_status').on(table.status),
  index('idx_demo_jobs_created_by').on(table.createdById),
  index('idx_demo_jobs_created_at').on(table.createdAt),
  index('idx_demo_jobs_created_tenant').on(table.createdTenantId),
  index('idx_demo_jobs_mode').on(table.mode),
]);

// Demo tenant metadata - additional info for demo-generated tenants
export const demoTenantMetadata = pgTable('demo_tenant_metadata', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().unique().references(() => tenants.id, { onDelete: 'cascade' }),
  generationJobId: uuid('generation_job_id').notNull().references(() => demoGenerationJobs.id, { onDelete: 'set null' }),
  // Denormalized fields for quick filtering
  country: varchar('country', { length: 2 }).notNull(),
  industry: varchar('industry', { length: 50 }).notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  // Flags
  isDemoGenerated: boolean('is_demo_generated').notNull().default(true),
  excludedFromAnalytics: boolean('excluded_from_analytics').notNull().default(true),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_demo_metadata_tenant').on(table.tenantId),
  index('idx_demo_metadata_country').on(table.country),
  index('idx_demo_metadata_industry').on(table.industry),
  index('idx_demo_metadata_job').on(table.generationJobId),
]);

// Demo patch jobs - tracks incremental updates to demo tenants
export const demoPatchJobs = pgTable('demo_patch_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Target tenant
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  // Link to original generation job (optional)
  originalJobId: uuid('original_job_id').references(() => demoGenerationJobs.id, { onDelete: 'set null' }),
  // Creator (master admin who initiated)
  createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  // Patch configuration
  mode: demoPatchModeEnum('mode').notNull().default('additive'),
  planType: demoPatchPlanTypeEnum('plan_type').notNull().default('deltas'),
  patchPlanJson: json('patch_plan_json').notNull(),
  seed: varchar('seed', { length: 64 }).notNull(),
  rangeStartMonth: varchar('range_start_month', { length: 7 }).notNull(), // YYYY-MM
  rangeEndMonth: varchar('range_end_month', { length: 7 }).notNull(), // YYYY-MM
  toleranceConfig: json('tolerance_config'),
  // KPI tracking
  beforeKpisJson: json('before_kpis_json'),
  afterKpisJson: json('after_kpis_json'),
  diffReportJson: json('diff_report_json'),
  // Execution status
  status: demoJobStatusEnum('status').notNull().default('pending'),
  progress: integer('progress').notNull().default(0), // 0-100
  currentStep: varchar('current_step', { length: 100 }),
  logs: json('logs').default([]),
  // Results
  metricsJson: json('metrics_json'), // { recordsCreated, recordsModified, recordsDeleted, byEntity }
  // Error info (if failed)
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),
  // Timestamps
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_patch_jobs_tenant').on(table.tenantId),
  index('idx_patch_jobs_status').on(table.status),
  index('idx_patch_jobs_created_at').on(table.createdAt),
  index('idx_patch_jobs_original_job').on(table.originalJobId),
  index('idx_patch_jobs_created_by').on(table.createdById),
]);

// Demo metric overrides - stores adjustments to report metrics without creating actual records
// Used by the 'metrics-only' patch mode
export const demoMetricOverrides = pgTable('demo_metric_overrides', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  // Month for which this override applies (YYYY-MM format)
  month: varchar('month', { length: 7 }).notNull(),
  // Metric overrides (these get ADDED to the computed values in reports)
  contactsCreatedOverride: integer('contacts_created_override').notNull().default(0),
  companiesCreatedOverride: integer('companies_created_override').notNull().default(0),
  dealsCreatedOverride: integer('deals_created_override').notNull().default(0),
  closedWonCountOverride: integer('closed_won_count_override').notNull().default(0),
  closedWonValueOverride: decimal('closed_won_value_override', { precision: 15, scale: 2 }).notNull().default('0'),
  activitiesCreatedOverride: integer('activities_created_override').notNull().default(0),
  // Link to the patch job that created this override
  patchJobId: uuid('patch_job_id').references(() => demoPatchJobs.id, { onDelete: 'set null' }),
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_metric_overrides_tenant').on(table.tenantId),
  index('idx_metric_overrides_month').on(table.tenantId, table.month),
  uniqueIndex('idx_metric_overrides_tenant_month').on(table.tenantId, table.month),
]);

// Relations
export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  users: many(users),
  contacts: many(contacts),
  companies: many(companies),
  deals: many(deals),
  activities: many(activities),
  tags: many(tags),
  pipelineStages: many(pipelineStages),
  apiKeys: many(apiKeys),
  auditLogs: many(auditLogs),
  importJobs: many(importJobs),
  invoices: many(invoices),
  billingInfo: one(tenantBillingInfo),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  invitedBy: one(users, { fields: [users.invitedById], references: [users.id] }),
  ownedContacts: many(contacts),
  ownedCompanies: many(companies),
  ownedDeals: many(deals),
  activities: many(activities),
  apiKeys: many(apiKeys),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  tenant: one(tenants, { fields: [contacts.tenantId], references: [tenants.id] }),
  company: one(companies, { fields: [contacts.companyId], references: [companies.id] }),
  owner: one(users, { fields: [contacts.ownerId], references: [users.id] }),
  contactTags: many(contactTags),
  deals: many(deals),
  activities: many(activities),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  tenant: one(tenants, { fields: [companies.tenantId], references: [tenants.id] }),
  owner: one(users, { fields: [companies.ownerId], references: [users.id] }),
  contacts: many(contacts),
  deals: many(deals),
  activities: many(activities),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  tenant: one(tenants, { fields: [deals.tenantId], references: [tenants.id] }),
  stage: one(pipelineStages, { fields: [deals.stageId], references: [pipelineStages.id] }),
  owner: one(users, { fields: [deals.ownerId], references: [users.id] }),
  contact: one(contacts, { fields: [deals.contactId], references: [contacts.id] }),
  company: one(companies, { fields: [deals.companyId], references: [companies.id] }),
  activities: many(activities),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  tenant: one(tenants, { fields: [tags.tenantId], references: [tenants.id] }),
  contactTags: many(contactTags),
}));

export const contactTagsRelations = relations(contactTags, ({ one }) => ({
  contact: one(contacts, { fields: [contactTags.contactId], references: [contacts.id] }),
  tag: one(tags, { fields: [contactTags.tagId], references: [tags.id] }),
}));

export const pipelineStagesRelations = relations(pipelineStages, ({ one, many }) => ({
  tenant: one(tenants, { fields: [pipelineStages.tenantId], references: [tenants.id] }),
  deals: many(deals),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  tenant: one(tenants, { fields: [activities.tenantId], references: [tenants.id] }),
  createdBy: one(users, { fields: [activities.createdById], references: [users.id] }),
  contact: one(contacts, { fields: [activities.contactId], references: [contacts.id] }),
  company: one(companies, { fields: [activities.companyId], references: [companies.id] }),
  deal: one(deals, { fields: [activities.dealId], references: [deals.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  tenant: one(tenants, { fields: [apiKeys.tenantId], references: [tenants.id] }),
  createdBy: one(users, { fields: [apiKeys.createdById], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, { fields: [auditLogs.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const importJobsRelations = relations(importJobs, ({ one }) => ({
  tenant: one(tenants, { fields: [importJobs.tenantId], references: [tenants.id] }),
  createdBy: one(users, { fields: [importJobs.createdById], references: [users.id] }),
}));

export const tenantBillingInfoRelations = relations(tenantBillingInfo, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantBillingInfo.tenantId], references: [tenants.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, { fields: [invoices.tenantId], references: [tenants.id] }),
  createdBy: one(users, { fields: [invoices.createdById], references: [users.id] }),
  issuedBy: one(users, { fields: [invoices.issuedById], references: [users.id] }),
  lineItems: many(invoiceLineItems),
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLineItems.invoiceId], references: [invoices.id] }),
}));

export const demoGenerationJobsRelations = relations(demoGenerationJobs, ({ one }) => ({
  createdBy: one(users, { fields: [demoGenerationJobs.createdById], references: [users.id] }),
  tenant: one(tenants, { fields: [demoGenerationJobs.createdTenantId], references: [tenants.id] }),
}));

export const demoTenantMetadataRelations = relations(demoTenantMetadata, ({ one }) => ({
  tenant: one(tenants, { fields: [demoTenantMetadata.tenantId], references: [tenants.id] }),
  generationJob: one(demoGenerationJobs, { fields: [demoTenantMetadata.generationJobId], references: [demoGenerationJobs.id] }),
}));

export const demoPatchJobsRelations = relations(demoPatchJobs, ({ one }) => ({
  tenant: one(tenants, { fields: [demoPatchJobs.tenantId], references: [tenants.id] }),
  originalJob: one(demoGenerationJobs, { fields: [demoPatchJobs.originalJobId], references: [demoGenerationJobs.id] }),
  createdBy: one(users, { fields: [demoPatchJobs.createdById], references: [users.id] }),
}));

export const demoMetricOverridesRelations = relations(demoMetricOverrides, ({ one }) => ({
  tenant: one(tenants, { fields: [demoMetricOverrides.tenantId], references: [tenants.id] }),
  patchJob: one(demoPatchJobs, { fields: [demoMetricOverrides.patchJobId], references: [demoPatchJobs.id] }),
}));

// Type exports
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Deal = typeof deals.$inferSelect;
export type NewDeal = typeof deals.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type NewPipelineStage = typeof pipelineStages.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type ImportJob = typeof importJobs.$inferSelect;
export type NewImportJob = typeof importJobs.$inferInsert;
export type PlatformSettings = typeof platformSettings.$inferSelect;
export type NewPlatformSettings = typeof platformSettings.$inferInsert;
export type TenantBillingInfo = typeof tenantBillingInfo.$inferSelect;
export type NewTenantBillingInfo = typeof tenantBillingInfo.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void' | 'overdue';
export type DemoGenerationJob = typeof demoGenerationJobs.$inferSelect;
export type NewDemoGenerationJob = typeof demoGenerationJobs.$inferInsert;
export type DemoTenantMetadata = typeof demoTenantMetadata.$inferSelect;
export type NewDemoTenantMetadata = typeof demoTenantMetadata.$inferInsert;
export type DemoPatchJob = typeof demoPatchJobs.$inferSelect;
export type NewDemoPatchJob = typeof demoPatchJobs.$inferInsert;
export type DemoMetricOverride = typeof demoMetricOverrides.$inferSelect;
export type NewDemoMetricOverride = typeof demoMetricOverrides.$inferInsert;
export type DemoJobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type DemoPatchMode = 'additive' | 'reconcile' | 'metrics-only';
export type DemoPatchPlanType = 'targets' | 'deltas';
