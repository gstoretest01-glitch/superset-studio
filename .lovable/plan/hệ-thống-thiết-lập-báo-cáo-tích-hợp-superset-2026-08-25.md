# Hệ thống thiết lập báo cáo + tích hợp Superset

## Bối cảnh

Bạn chưa có Superset instance. Superset là phần mềm Python tự host — Lovable không chạy được nó bên trong dự án này. Vì vậy hệ thống chia làm 2 phần:

- **Phần bạn tự dựng (ngoài Lovable):** một Superset OSS chạy bằng Docker trên server/VPS của bạn. Tôi sẽ cung cấp file cấu hình `superset_config.py` + `docker-compose` đã bật sẵn embedded, CORS, guest token, theme.
- **Phần tôi build trong Lovable:** ứng dụng "Report Studio" — nơi bạn tạo báo cáo, kéo thả chart từ Superset, tự chỉnh màu sắc, kích thước, breakpoint responsive.

Hướng render đã chốt: **nhúng từng chart riêng lẻ, layout do app tự quản lý** (né hoàn toàn lưới cố định của Superset).

## Kiến trúc

```text
Trình duyệt
  └─ Report Studio (TanStack Start)
       ├─ Builder: kéo thả block, chỉnh màu/size/breakpoint
       └─ Viewer: render grid responsive của riêng mình
            └─ mỗi block = 1 iframe chart Superset (standalone)
                   ↑ guest token
Lovable Cloud
  ├─ DB: reports, report_blocks, themes, superset_connections
  └─ Server functions: login Superset, cache session, sinh guest token, proxy REST API
Superset self-host (VPS của bạn)
```

Guest token **luôn** sinh ở server function, không bao giờ lộ credential ra trình duyệt.

## Các giai đoạn

### GĐ 1 — Nền tảng
- Bật Lovable Cloud (DB + auth + secrets).
- Design system riêng: bảng token màu, typography, spacing cho dashboard (không dùng theme mặc định).
- Đăng nhập/đăng ký, phân quyền `admin` / `editor` / `viewer` qua bảng `user_roles` riêng.

### GĐ 2 — Kết nối Superset
- Trang **Cài đặt kết nối**: nhập base URL Superset; user/password service account lưu vào Secrets.
- Server functions: `login` → cache access_token + CSRF ~4 phút, `refresh`, `testConnection`.
- Server function `listCharts` / `listDashboards` gọi `/api/v1/chart/` để hiển thị danh mục chart có sẵn.
- Server function `createGuestToken` nhận danh sách resource + RLS clause theo user đang đăng nhập.

### GĐ 3 — Report Builder
- CRUD báo cáo: tên, slug, mô tả, theme áp dụng, trạng thái (nháp/xuất bản).
- Canvas kéo thả (react-grid-layout ở phía app, **có breakpoint**: lg / md / sm / xs).
- Mỗi block cấu hình được:
  - nguồn: chart Superset (chọn từ danh mục) hoặc khối text/KPI tự vẽ
  - kích thước theo từng breakpoint (cột × hàng), chiều cao tối thiểu
  - màu nền, viền, bo góc, đổ bóng, tiêu đề hiển thị/ẩn
  - chế độ hiển thị mobile: giữ nguyên / thu nhỏ / ẩn
- Preview trực tiếp desktop / tablet / mobile ngay trong builder.

### GĐ 4 — Theme Manager
- Tạo nhiều bộ theme: bảng màu categorical (dùng cho chart), màu nền/chữ/viền, font, bo góc.
- Áp theme cho từng báo cáo.
- Nút **Đồng bộ theme sang Superset**: đẩy palette + token qua REST API (Superset ≥ 6.0 hỗ trợ theme token Ant Design v5) để chart bên trong iframe khớp màu với vỏ ngoài.
- Bổ sung CSS bơm vào iframe cho các phần Superset chưa expose.

### GĐ 5 — Viewer responsive
- Route công khai `/r/$slug` render báo cáo đã xuất bản.
- Grid tự reflow theo breakpoint; mỗi chart iframe dùng `standalone=1` + `ResizeObserver` để khớp container.
- Lazy-load: chart chỉ nạp khi cuộn tới (IntersectionObserver) — tránh mở 20 iframe cùng lúc.
- Chế độ toàn màn hình cho từng chart trên mobile.
- Skeleton loading + xử lý lỗi từng block độc lập.

### GĐ 6 — Hoàn thiện
- Chia sẻ link báo cáo (công khai / nội bộ), nhúng lại vào hệ thống khác.
- Xuất PDF / ảnh.
- Nhật ký truy cập báo cáo.

## Ghi chú kỹ thuật

- Superset pin phiên bản cố định (khuyến nghị nhánh 6.0.x đã test), không dùng `latest` — bản 6.0 từng có regression về guest token / embedded SDK.
- Cấu hình Superset bắt buộc: `EMBEDDED_SUPERSET=True`, `GUEST_ROLE_NAME`, `GUEST_TOKEN_JWT_SECRET`, `ENABLE_CORS` + origin của app, `TALISMAN_CONFIG.content_security_policy.frame-ancestors` chứa domain app (nếu không iframe sẽ bị chặn).
- Mọi lệnh POST/PUT/DELETE tới Superset cần header `X-CSRFToken` lấy từ `/api/v1/security/csrf_token/`.
- Multi-tenant: RLS clause được nhét vào guest token theo user, không lọc ở client.
- Dự phòng: block nào cần responsive tuyệt đối có thể chuyển sang chế độ "native" — gọi `/api/v1/chart/data` và tự vẽ bằng thư viện chart. Không làm ở GĐ đầu, nhưng schema sẽ chừa sẵn trường `render_mode`.

## Bắt đầu từ đâu

Đề xuất làm GĐ 1 + 2 trước, đồng thời tôi giao bạn bộ `docker-compose.yml` + `superset_config.py` để dựng Superset. Khi kết nối thông, làm tiếp GĐ 3–5.
