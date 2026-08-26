# Triển khai Apache Superset 6.0.0 cho Report Studio

## 1. Chuẩn bị

```bash
cd deploy/superset
cp .env.example .env
```

Sửa `.env`:
- `SUPERSET_SECRET_KEY` — bắt buộc, tạo bằng `openssl rand -base64 42`.
- `APP_DOMAIN` — domain thật của app Report Studio (dùng cho CORS/CSP). Khi chạy local là `http://localhost:8080`.
- Đặt mật khẩu admin và mật khẩu user dịch vụ (`SUPERSET_SERVICE_PASSWORD`) — **ghi lại**, sẽ dùng ở bước 3.

## 2. Chạy

```bash
docker compose up -d
```

Lần đầu `superset-init` sẽ chạy migrate DB, tạo user admin, `superset init` (gán role/permission mặc định),
rồi tạo user dịch vụ role **Gamma** (`create_service_user.py`). Theo dõi log:

```bash
docker compose logs -f superset-init
```

Khi thấy `[create_service_user] đã tạo user ...` là xong. Sau đó `superset` (webserver) và
`superset-worker` (celery, cho async query/cache) sẽ tự khởi động.

Truy cập UI: http://localhost:8088 (đăng nhập bằng tài khoản admin trong `.env`).

## 3. Cấp quyền đọc dataset cho user dịch vụ

User dịch vụ (`report_studio_svc` mặc định) chỉ có role Gamma — **không tự có quyền xem dataset nào**.
Vào **Settings → List Users**, hoặc gán quyền theo 1 trong 2 cách:

- Đơn giản: vào **Settings → List Roles → Gamma**, thêm permission `datasource_access` cho
  từng dataset cần dùng (hoặc tạo role riêng ví dụ `report_studio_reader` và gán cho user dịch vụ).
- Hoặc mở từng Dataset → **Edit → Access → Owners/Roles**, thêm role `Gamma` (hoặc role riêng).

Không gán role `Admin`/`Alpha` cho user dịch vụ — chỉ cấp quyền đọc dataset cần thiết.

## 4. Cắm vào Report Studio

1. Thêm secret trong app (theo cơ chế secret hiện có của dự án):
   - `SUPERSET_SERVICE_PASSWORD` = mật khẩu user dịch vụ đã đặt ở bước 1.
   - `SUPERSET_GUEST_TOKEN_SECRET` = giá trị `GUEST_TOKEN_JWT_SECRET` trong `.env` (chỉ cần nếu dùng chế độ iframe).
2. Vào `/connections` trong app, tạo kết nối mới:
   - `base_url`: `http://localhost:8088` (hoặc domain thật khi deploy)
   - `service_username`: `report_studio_svc` (hoặc giá trị bạn đặt)
   - `auth_provider`: `db`
   - Bấm **Test** → phải thấy "Kết nối thành công".
3. Mở một report, thêm block → danh sách chart của Superset phải hiện ra.

## Ghi chú vận hành

- **Production**: đổi toàn bộ mật khẩu mặc định, bật HTTPS trước `superset` (reverse proxy/ingress),
  set `TALISMAN_CONFIG.force_https = True` và `APP_DOMAIN` thành domain HTTPS thật.
- **Dừng/xoá**: `docker compose down` (giữ volume dữ liệu) hoặc `docker compose down -v` (xoá luôn dữ liệu — cẩn thận).
- **Nâng cấp phiên bản**: đổi tag image `apache/superset:6.0.0` ở 4 chỗ trong `docker-compose.yml`.
