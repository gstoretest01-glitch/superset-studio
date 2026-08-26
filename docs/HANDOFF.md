# Report Studio × Apache Superset — Tài liệu bàn giao & Kế hoạch phát triển tiếp

> Mục tiêu tài liệu: cho phép một agent khác (Antigravity / Claude Code) hoặc lập trình viên mới
> tiếp tục dự án mà **không cần đọc lại lịch sử chat**. Đọc hết phần 1–4 trước khi code.

---

## 1. Bối cảnh & quyết định kiến trúc đã chốt

**Bài toán**: xây hệ thống thiết lập báo cáo động, tích hợp Apache Superset (bản free, 6.0.0.x),
tự chủ động cấu hình **màu sắc + kích thước** báo cáo, và **responsive** (Superset gốc không responsive).

**Quyết định đã chốt (không đảo ngược trừ khi chủ dự án yêu cầu):**

| Vấn đề | Quyết định |
|---|---|
| Cách nhúng | **Nhúng/vẽ lại từng chart + layout riêng của app**, KHÔNG nhúng nguyên dashboard Superset |
| Nguồn dữ liệu chart | Gọi REST `POST /api/v1/chart/data` của Superset từ server, trả JSON về app |
| Vẽ chart | `recharts` (native, responsive 100%) — chế độ `iframe` giữ làm dự phòng |
| Layout | Lưới 12 cột tự viết, 3 breakpoint (lg/md/sm), cấu hình span + height riêng từng breakpoint |
| Backend | Lovable Cloud (Supabase) + TanStack Start `createServerFn`. **Không dùng Supabase Edge Functions** |
| Superset instance | **Chủ dự án chưa cài** — hiện chưa có kết nối thật, hệ thống đã sẵn sàng cắm vào |

**Stack**: TanStack Start v1 (React 19, Vite 7), Tailwind v4 (`src/styles.css`), shadcn/ui,
recharts, TanStack Query, Supabase (Lovable Cloud).

---

## 2. Hiện trạng — ĐÃ LÀM XONG

### 2.1 Cơ sở dữ liệu (đã migrate)
- `profiles` — hồ sơ người dùng, trigger `handle_new_user()`.
- `user_roles` + enum `app_role` (`admin | editor | viewer`), hàm security-definer `has_role()`, `can_edit()`.
- `superset_connections` — `base_url`, `service_username`, `auth_provider`, `is_default`, `last_status`.
- `report_themes` — palette[], màu nền/chữ/viền, font, radius, gap, `is_default`.
- `reports` — `slug`, `title`, `theme_id`, `connection_id`, `is_published`, `grid_columns`, `max_width_px`.
- `report_blocks` — `chart_id`, `chart_kind`, `render_mode`, `span_lg/md/sm`, `height_px`, `height_sm_px`,
  `hide_on_mobile`, màu nền/viền riêng, `row_limit`, và **`style_config jsonb`** (giao diện riêng từng chart).
- RLS + GRANT đầy đủ; RPC `get_public_block_context()` cho phép trang public đọc dữ liệu chart an toàn.

### 2.2 Backend (server functions)
- `src/lib/superset.server.ts` — client REST Superset: login (`/api/v1/security/login`), CSRF,
  list charts, `chart/data`, guest token.
- `src/lib/superset-creds.server.ts` — phân giải credential từ secret + context cho block public.
- `src/lib/superset.functions.ts` — `listCharts`, `getChartData`, `getPublicChartData`, `testConnection`.

### 2.3 Frontend
- `src/routes/index.tsx` — landing.
- `src/routes/auth.tsx` — đăng nhập Google + email/password.
- `src/routes/_authenticated/route.tsx` — cổng xác thực (`ssr: false`).
- `.../reports.index.tsx` — danh sách báo cáo, tạo/xoá/publish.
- `.../reports.$id.tsx` — **Report Builder**: canvas + inspector (tiêu đề, loại chart, row limit,
  span theo 3 breakpoint, chiều cao, ẩn trên mobile, màu nền riêng, và tab giao diện riêng).
- `.../connections.tsx` — quản lý kết nối Superset + test.
- `.../themes.tsx` — quản lý chủ đề (palette, màu, font, radius, gap).
- `src/routes/r.$slug.tsx` — trang xem công khai (responsive, lazy-load).
- `src/components/report/ReportCanvas.tsx` — lưới responsive + mô phỏng viewport + lazy load.
- `src/components/report/ChartRenderer.tsx` — vẽ KPI / table / pie / line / area / bar theo `BlockStyle`.
- `src/components/report/StyleInspector.tsx` — UI cấu hình giao diện riêng từng chart.
- `src/lib/block-style.ts` — schema `BlockStyle`, `DEFAULT_BLOCK_STYLE`, `resolveStyle`,
  `stylePalette`, `makeFormatter`, `applyDataShaping`.

### 2.4 Trạng thái build
`bunx tsgo --noEmit` sạch, build OK, mọi route trả 200.

---

## 3. CHƯA LÀM — danh sách công việc còn lại (theo thứ tự ưu tiên)

### P0 — Bắt buộc để hệ thống chạy thật

#### P0.1 Triển khai Superset 6.0.0 và cắm vào app
Tạo `deploy/superset/` gồm `docker-compose.yml` + `superset_config.py`.

```yaml
# deploy/superset/docker-compose.yml (rút gọn)
services:
  superset:
    image: apache/superset:6.0.0
    ports: ["8088:8088"]
    environment:
      SUPERSET_SECRET_KEY: ${SUPERSET_SECRET_KEY}
    volumes:
      - ./superset_config.py:/app/pythonpath/superset_config.py
  db:   { image: postgres:16 }
  redis: { image: redis:7 }
```

```python
# deploy/superset/superset_config.py — điểm mấu chốt
FEATURE_FLAGS = {
    "EMBEDDED_SUPERSET": True,
    "DASHBOARD_RBAC": True,
    "DRILL_BY": True,
    "DRILL_TO_DETAIL": True,
    "ALERT_REPORTS": True,
    "HORIZONTAL_FILTER_BAR": True,
}
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "origins": ["https://<domain-app>", "http://localhost:8080"],
}
TALISMAN_ENABLED = True
TALISMAN_CONFIG = {
    "content_security_policy": {"frame-ancestors": ["'self'", "https://<domain-app>"]},
}
GUEST_ROLE_NAME = "Gamma"
GUEST_TOKEN_JWT_SECRET = os.environ["GUEST_TOKEN_JWT_SECRET"]
SQLLAB_TIMEOUT = 300
```

Sau khi dựng: tạo user dịch vụ (role `Gamma` + quyền đọc dataset), rồi:
1. Thêm secret `SUPERSET_SERVICE_PASSWORD` (và `SUPERSET_GUEST_TOKEN_SECRET` nếu dùng iframe) qua tool secret.
2. Vào `/connections`, nhập `base_url`, `service_username`, `auth_provider` (`db` hoặc `ldap`), bấm **Test**.
3. Mở một report, thêm block → danh sách chart phải hiện.

**Tiêu chí hoàn thành**: `testConnection` trả `ok`, `listCharts` trả danh sách, một chart vẽ được bằng recharts.

#### P0.2 Seed dữ liệu mẫu & smoke test end-to-end
Chưa có báo cáo mẫu. Cần migration seed 1 theme + 1 report demo + vài block (dạng `text`/`kpi` tĩnh)
để màn hình đầu tiên không trống khi chưa có Superset.

#### P0.3 Kiểm thử phân quyền
Tạo tài khoản `viewer` và `editor`, xác nhận: viewer không sửa được, không thấy nút publish;
trang `/r/:slug` chỉ mở khi `is_published = true`.

---

### P1 — Tính năng cốt lõi còn thiếu

#### P1.1 Kéo–thả sắp xếp block (drag & drop)
Hiện chỉ có nút Lên/Xuống. Cần:
- Thêm `@dnd-kit/core` + `@dnd-kit/sortable`.
- Kéo thả trên canvas trong `reports.$id.tsx`, ghi lại `position` hàng loạt (một `upsert`).
- Kéo cạnh phải để đổi `span_lg` (snap theo 12 cột), kéo cạnh dưới để đổi `height_px`.
- Optimistic update qua `qc.setQueryData(["blocks", id], ...)` như code hiện tại.

#### P1.2 Bộ lọc cấp báo cáo (report filters)
- Bảng mới `report_filters` (id, report_id, label, column, type `select|daterange|text`,
  default_value, position) + `report_block_filters` (block_id, filter_id, target_column).
- Thanh filter hiển thị trên canvas và trang public.
- Truyền xuống `getChartData` dưới dạng `adhoc_filters` trong payload `chart/data`
  (xem `buildChartDataPayload` trong `superset.server.ts`).
- Cache key của React Query phải bao gồm giá trị filter.

#### P1.3 Trình duyệt dataset & tạo chart trong app
Hiện chỉ chọn chart có sẵn của Superset. Bổ sung:
- Server fn `listDatasets`, `getDatasetColumns` (`/api/v1/dataset/`).
- Block loại `adhoc_query`: chọn dataset + groupby + metric + orderby, dựng payload `chart/data`
  trực tiếp, không cần chart tồn tại sẵn trong Superset.

#### P1.4 Chế độ iframe (render_mode = 'iframe')
Cột `render_mode` đã có nhưng UI chưa dùng. Cần:
- Server fn `getGuestToken(dashboardId|chartUuid)` (đã có khung trong `superset.server.ts`).
- Component `SupersetEmbed.tsx` dùng `@superset-ui/embedded-sdk`, bọc trong `<ClientOnly>`
  (import động sau hydrate — tuyệt đối không import tĩnh vì SSR sẽ vỡ).
- Toggle "Vẽ native / Nhúng Superset" trong inspector.

---

### P2 — Nâng cao trải nghiệm

#### P2.1 Đồng bộ theme sang Superset 6.0
Superset 6.0 dùng theme token Ant Design v5. Có thể `PUT /api/v1/theme/` để đẩy palette của
`report_themes` sang Superset, giúp chart nhúng iframe khớp màu với app.

#### P2.2 Xuất báo cáo
- CSV/XLSX từng block (dữ liệu đã có sẵn client-side).
- PDF cả trang: `window.print()` + `@media print` trong `styles.css` là giải pháp rẻ nhất;
  bản chuẩn hơn dùng server route `/api/public/export/:slug` + trình duyệt headless (LƯU Ý:
  runtime là Cloudflare Worker — **không chạy được puppeteer**, phải gọi dịch vụ ngoài).

#### P2.3 Lịch gửi báo cáo
Dùng `pg_cron` gọi server route `src/routes/api/public/cron/send-reports.ts` (có xác thực bằng
header bí mật), route gọi Lovable Cloud email hoặc Superset Alerts & Reports.

#### P2.4 Chart nâng cao
Scatter, combo (bar + line), gauge, treemap, funnel, heatmap; thêm vào `CHART_KINDS`
(`src/lib/report-types.ts`) và nhánh render trong `ChartRenderer.tsx`.

#### P2.5 Vận hành
- Lịch sử phiên bản báo cáo (`report_versions` jsonb snapshot).
- Nhân bản báo cáo / block.
- Cache dữ liệu chart phía server (bảng `chart_cache` + TTL) để giảm tải Superset.
- Theo dõi lượt xem trang public.

---

## 4. Quy ước kỹ thuật BẮT BUỘC tuân thủ

1. **Không tạo Supabase Edge Function.** Logic nội bộ dùng `createServerFn` từ `@tanstack/react-start`;
   webhook/cron dùng file route trong `src/routes/api/public/*`.
2. **Không gọi server function bảo vệ (`requireSupabaseAuth`) từ loader của route công khai** —
   SSR/prerender không có token, build sẽ fail 401. Route public (`r.$slug.tsx`) chỉ dùng
   `getPublicChartData`.
3. **`exactOptionalPropertyTypes: true`** đang bật. Không truyền `undefined` cho prop optional của
   shadcn/recharts; dùng `disabled={x ?? false}` hoặc spread có điều kiện (`{...(v ? { v } : {})}`).
4. **Secret** đọc bằng `process.env['X']` **bên trong** `.handler()`, không đọc ở module scope.
5. **Màu sắc** luôn qua token trong `src/styles.css` hoặc giá trị từ `report_themes` — không hardcode
   `text-white`, `bg-black`, `bg-[#...]` trong component.
6. **Mọi `CREATE TABLE public.*` phải kèm `GRANT`** trong cùng migration, rồi mới `ENABLE RLS` + `CREATE POLICY`.
7. **Không sửa** `src/integrations/supabase/*` (tự sinh) và `src/routeTree.gen.ts`.
8. Mỗi route nội dung phải có `head()` riêng với title/description/og duy nhất.
9. Kiểm tra sau mỗi lượt sửa: `bunx tsgo --noEmit`, sau đó xem `/tmp/observability/build-errors.log`.

---

## 5. Bản đồ file nhanh

```
src/
  lib/
    block-style.ts          # schema giao diện riêng từng chart  ← mở rộng khi thêm loại chart
    report-types.ts         # Report, ReportBlock, ReportTheme, CHART_KINDS, inferSeries
    superset.server.ts      # REST client Superset (server-only)
    superset-creds.server.ts# phân giải credential + context public
    superset.functions.ts   # server functions cầu nối FE ↔ Superset
  components/report/
    ChartRenderer.tsx       # recharts theo BlockStyle           ← thêm loại chart tại đây
    ReportCanvas.tsx        # lưới 12 cột responsive + lazy load
    StyleInspector.tsx      # UI cấu hình BlockStyle
  routes/
    index.tsx  auth.tsx  r.$slug.tsx
    _authenticated/{route,reports.index,reports.$id,connections,themes}.tsx
supabase/migrations/        # 6 migration đã áp dụng
docs/HANDOFF.md             # tài liệu này
```

**Thêm một loại chart mới cần sửa 3 chỗ**: `CHART_KINDS` (report-types.ts) →
nhánh render (`ChartRenderer.tsx`) → nhóm tuỳ chọn riêng (`StyleInspector.tsx`).

---

## 6. Thứ tự thực thi đề xuất cho agent tiếp theo

1. P0.1 dựng Superset 6.0.0 + cắm kết nối (chặn mọi việc còn lại có liên quan dữ liệu thật).
2. P0.2 seed demo, P0.3 kiểm thử quyền.
3. P1.1 kéo–thả (tác động UX lớn nhất, không phụ thuộc Superset).
4. P1.2 bộ lọc → P1.3 tạo chart từ dataset.
5. P1.4 chế độ iframe (chỉ khi cần chart Superset đặc thù mà recharts không vẽ được).
6. P2 theo nhu cầu thực tế.
