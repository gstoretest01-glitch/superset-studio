ALTER TABLE public.report_blocks
  ADD COLUMN IF NOT EXISTS layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dataset_id integer,
  ADD COLUMN IF NOT EXISTS dataset_name text,
  ADD COLUMN IF NOT EXISTS adhoc_metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS adhoc_groupby jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS adhoc_filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS adhoc_order_desc boolean NOT NULL DEFAULT true;