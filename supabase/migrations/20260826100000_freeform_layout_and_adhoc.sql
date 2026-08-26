-- Lưới tự do (drag & resize kiểu Superset) + block "adhoc_query" (tạo chart mới trong app
-- bằng cách chọn dataset + cột, không cần chart có sẵn trong Superset).
--
-- `layout` thay thế span_lg/md/sm + height_px/height_sm_px làm nguồn xác định vị trí/kích
-- thước khi có giá trị; các cột cũ được giữ nguyên làm fallback cho dữ liệu đã tồn tại
-- (xem resolveLayout() trong src/lib/report-types.ts).
ALTER TABLE public.report_blocks
  ADD COLUMN IF NOT EXISTS layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dataset_id integer,
  ADD COLUMN IF NOT EXISTS dataset_name text,
  ADD COLUMN IF NOT EXISTS adhoc_metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS adhoc_groupby jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS adhoc_filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS adhoc_order_desc boolean NOT NULL DEFAULT true;
