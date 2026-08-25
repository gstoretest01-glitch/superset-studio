# Hoàn thiện Report Studio + khai thác trọn bản Superset 6.0 free

## Hiện trạng
Đã có: đăng nhập/phân quyền, quản lý kết nối Superset, quản lý chủ đề, trình dựng báo cáo (khối văn bản + biểu đồ), trang xem công khai `/r/:slug`, lớp gọi REST Superset phía máy chủ (đăng nhập, CSRF, danh mục chart, dữ liệu thô, guest token).

Còn thiếu để "chạy thật": chưa có máy chủ Superset, chưa lưu tài khoản dịch vụ, chưa có bộ lọc/tham số, chưa có xuất file, chưa có lịch/cảnh báo.

## Phần A — Dựng Superset 6.0 (bạn làm trên VPS, tôi giao file)

1. `docker-compose.yml` ghim `apache/superset:6.0.0` + Postgres (metadata) + Redis (cache/async) + Celery worker & beat.
2. `superset_config.py` bật sẵn:
   - `EMBEDDED_SUPERSET=True`, `GUEST_ROLE_NAME`, `GUEST_TOKEN_JWT_SECRET`, thời hạn token.
   - `ENABLE_CORS` + origin của app; `TALISMAN_CONFIG` cho `frame-ancestors` chứa domain app.
   - Feature flags bản free đáng bật: `ALERT_REPORTS`, `DASHBOARD_RBAC`, `EMBEDDED_SUPERSET`, `DRILL_BY`, `DRILL_TO_DETAIL`, `HORIZONTAL_FILTER_BAR`, `TAGGING_SYSTEM`, `SSH_TUNNELING`, `THEME_SYSTEM`.
   - Cache Redis cho chart data + thumbnail, `SQLLAB_ASYNC` qua Celery.
   - SMTP + `WEBDRIVER` (Chromium headless) để bật báo cáo định kỳ và ảnh chụp.
3. Tạo tài khoản dịch vụ `report_studio` (role Gamma + quyền đọc chart/dataset) — dùng cho app gọi API.
4. Kiểm thử: `/api/v1/security/login` → `/api/v1/me/` → nút "Kiểm tra kết nối" trong app báo xanh.

## Phần B — Lưu bí mật và thông kết nối
- Lưu `SUPERSET_SERVICE_USER`, `SUPERSET_SERVICE_PASSWORD` vào kho bí mật dự án.
- Thêm `SUPERSET_GUEST_TOKEN_SECRET` nếu dùng chế độ nhúng iframe.
- Trang Kết nối: hiện phiên bản Superset, số dataset/chart đọc được, trạng thái CORS.

## Phần C — Bổ sung tính năng app (tôi build)

### C1. Nguồn dữ liệu đầy đủ
- Duyệt theo **dashboard → chart**, theo **dataset**, theo **tag**; tìm kiếm, phân trang, xem trước dữ liệu.
- Hỗ trợ khối **truy vấn tùy chỉnh**: chọn dataset + metric + dimension + filter, gọi `/api/v1/chart/data` — không cần tạo chart trong Superset.

### C2. Bộ lọc báo cáo (quan trọng nhất còn thiếu)
- Thanh lọc cấp báo cáo: khoảng thời gian, danh sách chọn (lấy giá trị từ dataset), ô nhập.
- Lọc truyền xuống `adhoc_filters` khi gọi dữ liệu; lưu trạng thái lọc trên URL để chia sẻ.
- Ánh xạ cột lọc theo từng khối (khối nào áp dụng, khối nào bỏ qua).

### C3. Trình dựng nâng cao
- Kéo–thả sắp xếp & đổi cỡ trực tiếp trên lưới (hiện chỉ chỉnh bằng ô nhập).
- Khối mới: KPI so sánh kỳ trước, bảng có sắp xếp/phân trang, khối ảnh/logo, khối phân cách.
- Nhân bản khối, hoàn tác/làm lại, lưu bản nháp tự động.

### C4. Chế độ hiển thị kép
- `render_mode = native` (mặc định): vẽ lại bằng Recharts → responsive thật.
- `render_mode = iframe`: nhúng chart/dashboard Superset qua guest token khi cần loại biểu đồ đặc thù (bản đồ, sankey, big number trend, pivot phức tạp) mà không muốn vẽ lại.
- Tự gợi ý chế độ theo `viz_type`.

### C5. Chủ đề & đồng bộ
- Đồng bộ bảng màu app → Superset 6 qua API theme (Ant Design v5 token) để iframe khớp màu.
- Chế độ sáng/tối cho trang xem công khai.

### C6. Chia sẻ & xuất bản
- Link công khai có mật khẩu tùy chọn, thời hạn hết hiệu lực.
- Xuất PDF / PNG toàn báo cáo, xuất CSV/Excel từng khối.
- Nhúng lại báo cáo vào hệ thống khác bằng `<iframe>` + khóa nhúng.

### C7. Vận hành
- Bộ nhớ đệm dữ liệu biểu đồ (theo khối + bộ lọc, TTL cấu hình được) để không đập vào Superset mỗi lần tải.
- Nhật ký xem báo cáo, thống kê lượt xem.
- Gửi báo cáo định kỳ qua email (dùng lịch của Lovable Cloud gọi endpoint nội bộ).

## Thứ tự đề xuất
1. Phần A + B — có Superset thật, thông kết nối. (bạn + tôi hỗ trợ)
2. C1 + C2 — nguồn dữ liệu đầy đủ và bộ lọc. Đây là bước biến app thành "báo cáo động".
3. C3 + C4 — trải nghiệm dựng báo cáo và phủ hết loại biểu đồ.
4. C5 + C6 + C7 — hoàn thiện, chia sẻ, vận hành.

## Ghi chú kỹ thuật
- Mọi lời gọi Superset đều qua server function; trình duyệt không bao giờ thấy tài khoản dịch vụ.
- Phiên đăng nhập Superset cache ~4 phút kèm CSRF; POST cần `X-CSRFToken` + Referer.
- Ghim đúng `6.0.0.x`, không dùng thẻ `latest` — bản 6.0 từng có lỗi hồi quy ở guest token.
- Đa tổ chức: RLS clause nhét vào guest token / tham số truy vấn phía máy chủ, không lọc ở client.

## Bước tiếp theo ngay
Nếu bạn đồng ý, tôi bắt đầu bằng việc tạo bộ `docker-compose.yml` + `superset_config.py` trong dự án (thư mục `superset/`) và mở rộng trang Kết nối để kiểm tra sức khỏe chi tiết.
