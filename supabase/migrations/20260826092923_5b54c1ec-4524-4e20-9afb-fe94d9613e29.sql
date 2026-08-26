ALTER TABLE public.report_blocks
  ADD COLUMN IF NOT EXISTS container_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS parent_block_id uuid REFERENCES public.report_blocks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_slot text;

CREATE INDEX IF NOT EXISTS report_blocks_parent_idx ON public.report_blocks(parent_block_id);