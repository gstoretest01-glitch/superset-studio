"""Cấu hình Superset 6.0.0 cho Report Studio.

Biến môi trường bắt buộc: SUPERSET_SECRET_KEY.
Biến tuỳ chọn: GUEST_TOKEN_JWT_SECRET (chỉ cần khi dùng render_mode = 'iframe'), APP_DOMAIN.
"""

import os

# --- Cơ sở dữ liệu metadata & cache ---------------------------------------
DATABASE_DIALECT = os.environ.get("DATABASE_DIALECT", "postgresql")
DATABASE_USER = os.environ.get("DATABASE_USER", "superset")
DATABASE_PASSWORD = os.environ.get("DATABASE_PASSWORD", "superset")
DATABASE_HOST = os.environ.get("DATABASE_HOST", "db")
DATABASE_PORT = os.environ.get("DATABASE_PORT", "5432")
DATABASE_DB = os.environ.get("DATABASE_DB", "superset")

SQLALCHEMY_DATABASE_URI = (
    f"{DATABASE_DIALECT}://{DATABASE_USER}:{DATABASE_PASSWORD}"
    f"@{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_DB}"
)

REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = os.environ.get("REDIS_PORT", "6379")

CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_cache_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": 1,
}
DATA_CACHE_CONFIG = CACHE_CONFIG

class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    imports = ("superset.sql_lab",)
    worker_prefetch_multiplier = 1
    task_acks_late = True

CELERY_CONFIG = CeleryConfig

# --- Bảo mật & khoá ---------------------------------------------------------
SECRET_KEY = os.environ["SUPERSET_SECRET_KEY"]

# --- Feature flags -----------------------------------------------------------
FEATURE_FLAGS = {
    "EMBEDDED_SUPERSET": True,
    "DASHBOARD_RBAC": True,
    "DRILL_BY": True,
    "DRILL_TO_DETAIL": True,
    "ALERT_REPORTS": True,
    "HORIZONTAL_FILTER_BAR": True,
}

# --- CORS: cho phép app Report Studio gọi REST API từ trình duyệt hoặc server ---
APP_DOMAIN = os.environ.get("APP_DOMAIN", "http://localhost:8080")

ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "origins": [APP_DOMAIN, "http://localhost:8080"],
}

# --- Cho phép nhúng iframe (chỉ áp dụng khi dùng render_mode = 'iframe') ---
TALISMAN_ENABLED = True
TALISMAN_CONFIG = {
    "content_security_policy": {
        "frame-ancestors": ["'self'", APP_DOMAIN],
    },
    "force_https": False,
}

# --- Guest token cho embedded dashboard (P1.4) ------------------------------
GUEST_ROLE_NAME = "Gamma"
GUEST_TOKEN_JWT_SECRET = os.environ.get("GUEST_TOKEN_JWT_SECRET", SECRET_KEY)
GUEST_TOKEN_JWT_ALGO = "HS256"
GUEST_TOKEN_HEADER_NAME = "X-GuestToken"

# --- Khác --------------------------------------------------------------------
SQLLAB_TIMEOUT = 300
WTF_CSRF_ENABLED = True
WTF_CSRF_EXEMPT_LIST = [r"^/api/v1/security/login$"]

# Cho phép PUBLIC_ROLE_LIKE_GAMMA nếu cần dataset công khai đơn giản; mặc định tắt.
PUBLIC_ROLE_LIKE = None
