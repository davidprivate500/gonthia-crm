-- Add 'metrics-only' value to the demo_patch_mode enum
ALTER TYPE demo_patch_mode ADD VALUE IF NOT EXISTS 'metrics-only';

-- Create demoMetricOverrides table for storing report metric adjustments
CREATE TABLE IF NOT EXISTS demo_metric_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- YYYY-MM format
  closed_won_count_override INTEGER NOT NULL DEFAULT 0,
  closed_won_value_override DECIMAL(15, 2) NOT NULL DEFAULT 0,
  patch_job_id UUID REFERENCES demo_patch_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_metric_overrides_tenant ON demo_metric_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metric_overrides_month ON demo_metric_overrides(tenant_id, month);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_overrides_tenant_month ON demo_metric_overrides(tenant_id, month);
