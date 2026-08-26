"""Tạo user dịch vụ dùng cho kết nối REST từ Report Studio (role Gamma).

Chạy tự động trong entrypoint của service `superset-init` sau `superset init`.
Idempotent: bỏ qua nếu user đã tồn tại.
"""

import os

from superset.app import create_app

app = create_app()

with app.app_context():
    from superset import security_manager

    username = os.environ.get("SUPERSET_SERVICE_USERNAME", "report_studio_svc")
    password = os.environ.get("SUPERSET_SERVICE_PASSWORD", "change-me-service-pass")
    email = os.environ.get("SUPERSET_SERVICE_EMAIL", "report-studio-svc@example.com")

    existing = security_manager.find_user(username=username)
    if existing:
        print(f"[create_service_user] user '{username}' đã tồn tại, bỏ qua.")
    else:
        gamma_role = security_manager.find_role("Gamma")
        user = security_manager.add_user(
            username=username,
            first_name="Report",
            last_name="Studio",
            email=email,
            role=gamma_role,
            password=password,
        )
        if user:
            print(f"[create_service_user] đã tạo user '{username}' với role Gamma.")
        else:
            print(f"[create_service_user] LỖI: không tạo được user '{username}'.")
