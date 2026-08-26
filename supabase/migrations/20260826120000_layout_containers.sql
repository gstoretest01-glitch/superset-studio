-- Tabs / Row / Column làm "layout element" giống Superset thật: container là 1 report_blocks
-- bình thường (chiếm 1 ô trên lưới tự do như block khác), các block bên trong trỏ về nó qua
-- parent_block_id + parent_slot thay vì có layout (x/y/w/h) riêng — cha quyết định bố cục.
ALTER TABLE public.report_blocks
  ADD COLUMN IF NOT EXISTS container_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS parent_block_id uuid REFERENCES public.report_blocks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_slot text;

CREATE INDEX IF NOT EXISTS report_blocks_parent_idx ON public.report_blocks(parent_block_id);
