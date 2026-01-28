-- Add all metric override columns to demo_metric_overrides table
-- This allows the 'metrics-only' mode to adjust all metrics, not just won deals/value

ALTER TABLE demo_metric_overrides
  ADD COLUMN IF NOT EXISTS contacts_created_override INTEGER NOT NULL DEFAULT 0;

ALTER TABLE demo_metric_overrides
  ADD COLUMN IF NOT EXISTS companies_created_override INTEGER NOT NULL DEFAULT 0;

ALTER TABLE demo_metric_overrides
  ADD COLUMN IF NOT EXISTS deals_created_override INTEGER NOT NULL DEFAULT 0;

ALTER TABLE demo_metric_overrides
  ADD COLUMN IF NOT EXISTS activities_created_override INTEGER NOT NULL DEFAULT 0;
