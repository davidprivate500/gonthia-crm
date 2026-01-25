-- Add generation phase and state fields for chunked/resumable generation
ALTER TABLE demo_generation_jobs ADD COLUMN IF NOT EXISTS generation_phase VARCHAR(50) DEFAULT 'init';
ALTER TABLE demo_generation_jobs ADD COLUMN IF NOT EXISTS generation_state JSONB;

-- Add index for finding jobs that need continuation
CREATE INDEX IF NOT EXISTS idx_demo_jobs_phase ON demo_generation_jobs(generation_phase) WHERE status = 'running';
