ALTER TABLE public.report_blocks
  ADD COLUMN IF NOT EXISTS style_config jsonb NOT NULL DEFAULT '{}'::jsonb;