-- Add model inference fields for server-side decision pipeline.
ALTER TABLE public.vitals
ADD COLUMN IF NOT EXISTS model_status TEXT,
ADD COLUMN IF NOT EXISTS final_status TEXT,
ADD COLUMN IF NOT EXISTS model_confidence DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS decision_source TEXT,
ADD COLUMN IF NOT EXISTS model_updated_at TIMESTAMP WITH TIME ZONE;

-- Helpful index for worker polling unresolved rows.
CREATE INDEX IF NOT EXISTS idx_vitals_final_status_null
ON public.vitals (created_at DESC)
WHERE final_status IS NULL;
