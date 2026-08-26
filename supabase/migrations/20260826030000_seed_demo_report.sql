-- Seed: 1 báo cáo demo với vài khối tĩnh (không cần kết nối Superset) để màn hình đầu tiên
-- không trống trước khi có Superset thật. An toàn khi chạy lại (ON CONFLICT DO NOTHING).

INSERT INTO public.reports (slug, title, description, theme_id, is_published, grid_columns, max_width_px)
SELECT
  'demo',
  'Báo cáo mẫu',
  'Báo cáo minh hoạ bố cục và giao diện — chưa nối dữ liệu Superset thật.',
  (SELECT id FROM public.report_themes WHERE is_default = true LIMIT 1),
  true,
  12,
  1440
WHERE NOT EXISTS (SELECT 1 FROM public.reports WHERE slug = 'demo');

WITH demo_report AS (
  SELECT id FROM public.reports WHERE slug = 'demo'
)
INSERT INTO public.report_blocks
  (report_id, block_type, render_mode, title, body, position, span_lg, span_md, span_sm, height_px, height_sm_px, show_title)
SELECT r.id, v.block_type, 'native', v.title, v.body, v.position, v.span_lg, v.span_md, v.span_sm, v.height_px, v.height_sm_px, v.show_title
FROM demo_report r
CROSS JOIN (
  VALUES
    ('heading', 'Chào mừng đến với Report Studio', NULL::text, 0, 12, 12, 12, 90, 80, true),
    ('text', NULL::text, 'Đây là báo cáo mẫu dựng sẵn để bạn hình dung bố cục lưới responsive.' ||
      E'\n' || 'Kết nối Apache Superset ở trang "Kết nối" rồi thêm khối biểu đồ thật vào đây.', 1, 12, 12, 12, 120, 140, false),
    ('text', 'Bước tiếp theo', 'Vào /connections để tạo kết nối, sau đó quay lại báo cáo và thêm khối "Biểu đồ Superset".', 2, 6, 6, 12, 160, 160, true),
    ('text', 'Ghi chú', 'Có thể chỉnh màu sắc, kích thước riêng cho từng khối ở tab "Giao diện" trong ô kiểm tra bên phải.', 3, 6, 6, 12, 160, 160, true)
) AS v(block_type, title, body, position, span_lg, span_md, span_sm, height_px, height_sm_px, show_title)
WHERE NOT EXISTS (
  SELECT 1 FROM public.report_blocks b WHERE b.report_id = r.id
);
