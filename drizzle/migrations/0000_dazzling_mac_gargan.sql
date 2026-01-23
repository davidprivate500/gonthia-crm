CREATE TYPE "public"."activity_type" AS ENUM('note', 'call', 'email', 'meeting', 'task');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'login_success', 'login_failed', 'logout', 'password_reset_request', 'password_reset_success', 'impersonation_start', 'impersonation_end');--> statement-breakpoint
CREATE TYPE "public"."contact_status" AS ENUM('lead', 'prospect', 'customer', 'churned', 'other');--> statement-breakpoint
CREATE TYPE "public"."demo_generation_mode" AS ENUM('growth-curve', 'monthly-plan');--> statement-breakpoint
CREATE TYPE "public"."demo_job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."demo_patch_mode" AS ENUM('additive', 'reconcile');--> statement-breakpoint
CREATE TYPE "public"."demo_patch_plan_type" AS ENUM('targets', 'deltas');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'paid', 'void', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'member', 'readonly');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "activity_type" NOT NULL,
	"subject" varchar(255) NOT NULL,
	"description" text,
	"contact_id" uuid,
	"company_id" uuid,
	"deal_id" uuid,
	"created_by_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_minutes" integer,
	"demo_generated" boolean DEFAULT false,
	"demo_job_id" uuid,
	"demo_source_month" varchar(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(8) NOT NULL,
	"created_by_id" uuid NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"old_values" json,
	"new_values" json,
	"metadata" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255),
	"industry" varchar(100),
	"size" varchar(20),
	"owner_id" uuid,
	"address" varchar(500),
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100),
	"postal_code" varchar(20),
	"phone" varchar(50),
	"website" varchar(500),
	"notes" text,
	"demo_generated" boolean DEFAULT false,
	"demo_job_id" uuid,
	"demo_source_month" varchar(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contact_tags" (
	"contact_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"company_id" uuid,
	"owner_id" uuid,
	"status" "contact_status" DEFAULT 'lead' NOT NULL,
	"demo_generated" boolean DEFAULT false,
	"demo_job_id" uuid,
	"demo_source_month" varchar(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"value" numeric(15, 2),
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"stage_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"owner_id" uuid,
	"contact_id" uuid,
	"company_id" uuid,
	"expected_close_date" timestamp with time zone,
	"probability" integer,
	"notes" text,
	"demo_generated" boolean DEFAULT false,
	"demo_job_id" uuid,
	"demo_source_month" varchar(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "demo_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_id" uuid,
	"status" "demo_job_status" DEFAULT 'pending' NOT NULL,
	"mode" "demo_generation_mode" DEFAULT 'growth-curve' NOT NULL,
	"config" json NOT NULL,
	"seed" varchar(64) NOT NULL,
	"monthly_plan_json" json,
	"plan_version" varchar(20),
	"tolerance_config" json,
	"created_tenant_id" uuid,
	"progress" integer DEFAULT 0 NOT NULL,
	"current_step" varchar(100),
	"logs" json DEFAULT '[]'::json,
	"metrics" json,
	"verification_report" json,
	"verification_passed" boolean,
	"error_message" text,
	"error_stack" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_patch_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"original_job_id" uuid,
	"created_by_id" uuid NOT NULL,
	"mode" "demo_patch_mode" DEFAULT 'additive' NOT NULL,
	"plan_type" "demo_patch_plan_type" DEFAULT 'deltas' NOT NULL,
	"patch_plan_json" json NOT NULL,
	"seed" varchar(64) NOT NULL,
	"range_start_month" varchar(7) NOT NULL,
	"range_end_month" varchar(7) NOT NULL,
	"tolerance_config" json,
	"before_kpis_json" json,
	"after_kpis_json" json,
	"diff_report_json" json,
	"status" "demo_job_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"current_step" varchar(100),
	"logs" json DEFAULT '[]'::json,
	"metrics_json" json,
	"error_message" text,
	"error_stack" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_tenant_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"generation_job_id" uuid NOT NULL,
	"country" varchar(2) NOT NULL,
	"industry" varchar(50) NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"is_demo_generated" boolean DEFAULT true NOT NULL,
	"excluded_from_analytics" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demo_tenant_metadata_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"status" "import_status" DEFAULT 'pending' NOT NULL,
	"total_rows" integer,
	"processed_rows" integer DEFAULT 0,
	"successful_rows" integer DEFAULT 0,
	"failed_rows" integer DEFAULT 0,
	"error_report" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_number_sequence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"issue_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"subtotal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2),
	"tax_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"issuer_snapshot" json,
	"client_snapshot" json,
	"notes" text,
	"internal_notes" text,
	"created_by_id" uuid NOT NULL,
	"issued_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7) DEFAULT '#6366f1',
	"position" integer NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"registration_id" varchar(100),
	"vat_id" varchar(50),
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"postal_code" varchar(20),
	"country" varchar(100),
	"email" varchar(255),
	"phone" varchar(50),
	"website" varchar(500),
	"logo_url" varchar(500),
	"bank_name" varchar(255),
	"bank_account_name" varchar(255),
	"bank_account_number" varchar(100),
	"bank_routing_number" varchar(50),
	"bank_swift_code" varchar(20),
	"bank_iban" varchar(50),
	"crypto_wallet_address" varchar(255),
	"crypto_network" varchar(50),
	"payment_instructions" text,
	"invoice_prefix" varchar(10) DEFAULT 'INV' NOT NULL,
	"invoice_footer_text" text,
	"default_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"default_payment_terms_days" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"color" varchar(7) DEFAULT '#6366f1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tenant_billing_info" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"legal_name" varchar(255),
	"registration_id" varchar(100),
	"vat_id" varchar(50),
	"billing_address" text,
	"billing_city" varchar(100),
	"billing_state" varchar(100),
	"billing_postal_code" varchar(20),
	"billing_country" varchar(100),
	"billing_email" varchar(255),
	"billing_phone" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_billing_info_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"tenant_id" uuid,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"is_master_admin" boolean DEFAULT false NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"invited_by_id" uuid,
	"invite_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_generation_jobs" ADD CONSTRAINT "demo_generation_jobs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_generation_jobs" ADD CONSTRAINT "demo_generation_jobs_created_tenant_id_tenants_id_fk" FOREIGN KEY ("created_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_patch_jobs" ADD CONSTRAINT "demo_patch_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_patch_jobs" ADD CONSTRAINT "demo_patch_jobs_original_job_id_demo_generation_jobs_id_fk" FOREIGN KEY ("original_job_id") REFERENCES "public"."demo_generation_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_patch_jobs" ADD CONSTRAINT "demo_patch_jobs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_tenant_metadata" ADD CONSTRAINT "demo_tenant_metadata_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_tenant_metadata" ADD CONSTRAINT "demo_tenant_metadata_generation_job_id_demo_generation_jobs_id_fk" FOREIGN KEY ("generation_job_id") REFERENCES "public"."demo_generation_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_by_id_users_id_fk" FOREIGN KEY ("issued_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_billing_info" ADD CONSTRAINT "tenant_billing_info_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activities_tenant_id" ON "activities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_activities_contact_id" ON "activities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_activities_company_id" ON "activities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_activities_deal_id" ON "activities" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_activities_created_by_id" ON "activities" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "idx_activities_scheduled_at" ON "activities" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_activities_deleted_at" ON "activities" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_activities_demo_generated" ON "activities" USING btree ("tenant_id","demo_generated");--> statement-breakpoint
CREATE INDEX "idx_activities_demo_job" ON "activities" USING btree ("demo_job_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_tenant_id" ON "api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_key_hash" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_api_keys_revoked_at" ON "api_keys" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_tenant_id" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_companies_tenant_id" ON "companies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_companies_owner_id" ON "companies" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_companies_deleted_at" ON "companies" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_companies_demo_generated" ON "companies" USING btree ("tenant_id","demo_generated");--> statement-breakpoint
CREATE INDEX "idx_companies_demo_job" ON "companies" USING btree ("demo_job_id");--> statement-breakpoint
CREATE INDEX "idx_contact_tags_contact_id" ON "contact_tags" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_contact_tags_tag_id" ON "contact_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_tenant_id" ON "contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_company_id" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_owner_id" ON "contacts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_deleted_at" ON "contacts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_contacts_email" ON "contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_contacts_status" ON "contacts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_contacts_demo_generated" ON "contacts" USING btree ("tenant_id","demo_generated");--> statement-breakpoint
CREATE INDEX "idx_contacts_demo_job" ON "contacts" USING btree ("demo_job_id");--> statement-breakpoint
CREATE INDEX "idx_deals_tenant_id" ON "deals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_deals_stage_id" ON "deals" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "idx_deals_owner_id" ON "deals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_deals_contact_id" ON "deals" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_deals_company_id" ON "deals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_deals_deleted_at" ON "deals" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_deals_position" ON "deals" USING btree ("stage_id","position");--> statement-breakpoint
CREATE INDEX "idx_deals_demo_generated" ON "deals" USING btree ("tenant_id","demo_generated");--> statement-breakpoint
CREATE INDEX "idx_deals_demo_job" ON "deals" USING btree ("demo_job_id");--> statement-breakpoint
CREATE INDEX "idx_demo_jobs_status" ON "demo_generation_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_demo_jobs_created_by" ON "demo_generation_jobs" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "idx_demo_jobs_created_at" ON "demo_generation_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_demo_jobs_created_tenant" ON "demo_generation_jobs" USING btree ("created_tenant_id");--> statement-breakpoint
CREATE INDEX "idx_demo_jobs_mode" ON "demo_generation_jobs" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "idx_patch_jobs_tenant" ON "demo_patch_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_patch_jobs_status" ON "demo_patch_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_patch_jobs_created_at" ON "demo_patch_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_patch_jobs_original_job" ON "demo_patch_jobs" USING btree ("original_job_id");--> statement-breakpoint
CREATE INDEX "idx_patch_jobs_created_by" ON "demo_patch_jobs" USING btree ("created_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_demo_metadata_tenant" ON "demo_tenant_metadata" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_demo_metadata_country" ON "demo_tenant_metadata" USING btree ("country");--> statement-breakpoint
CREATE INDEX "idx_demo_metadata_industry" ON "demo_tenant_metadata" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "idx_demo_metadata_job" ON "demo_tenant_metadata" USING btree ("generation_job_id");--> statement-breakpoint
CREATE INDEX "idx_import_jobs_tenant_id" ON "import_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_import_jobs_created_by_id" ON "import_jobs" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "idx_import_jobs_status" ON "import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_invoice_id" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_line_items_position" ON "invoice_line_items" USING btree ("invoice_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invoice_number_sequence_year" ON "invoice_number_sequence" USING btree ("year");--> statement-breakpoint
CREATE INDEX "idx_invoices_tenant_id" ON "invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_status" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invoices_issue_date" ON "invoices" USING btree ("issue_date");--> statement-breakpoint
CREATE INDEX "idx_invoices_due_date" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_invoices_created_by_id" ON "invoices" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_hash" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_user_id" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pipeline_stages_tenant_id" ON "pipeline_stages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_pipeline_stages_position" ON "pipeline_stages" USING btree ("position");--> statement-breakpoint
CREATE INDEX "idx_pipeline_stages_deleted_at" ON "pipeline_stages" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_tags_tenant_id" ON "tags" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tags_deleted_at" ON "tags" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_tenant_billing_info_tenant_id" ON "tenant_billing_info" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_users_tenant_id" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_deleted_at" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_users_is_master_admin" ON "users" USING btree ("is_master_admin");