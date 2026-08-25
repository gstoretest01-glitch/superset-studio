ALTER TABLE public.report_blocks
  ADD COLUMN chart_kind TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN embed_uuid TEXT,
  ADD COLUMN row_limit INT NOT NULL DEFAULT 500;