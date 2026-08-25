/**
 * Lớp giao tiếp REST với Apache Superset (chỉ chạy phía máy chủ).
 * Không bao giờ import file này từ component.
 */

type Session = {
  accessToken: string;
  csrfToken: string;
  cookie: string;
  expiresAt: number;
};

const sessionCache = new Map<string, Session>();

export type SupersetCreds = {
  baseUrl: string;
  username: string;
  password: string;
  provider?: string;
};

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function collectCookies(res: Response): string {
  const raw =
    // Cloudflare/undici expose getSetCookie(); fall back to the single header.
    (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
    (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")!] : []);
  return raw
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

export async function getSupersetSession(creds: SupersetCreds): Promise<Session> {
  const base = normalizeBaseUrl(creds.baseUrl);
  const key = `${base}::${creds.username}`;
  const cached = sessionCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached;

  const loginRes = await fetch(`${base}/api/v1/security/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: creds.username,
      password: creds.password,
      provider: creds.provider || "db",
      refresh: true,
    }),
  });

  if (!loginRes.ok) {
    const text = await loginRes.text().catch(() => "");
    throw new Error(
      `Đăng nhập Superset thất bại (${loginRes.status}). ${text.slice(0, 200)}`,
    );
  }

  const login = (await loginRes.json()) as { access_token?: string };
  if (!login.access_token) throw new Error("Superset không trả về access_token.");

  let cookie = collectCookies(loginRes);
  let csrfToken = "";
  try {
    const csrfRes = await fetch(`${base}/api/v1/security/csrf_token/`, {
      headers: {
        Authorization: `Bearer ${login.access_token}`,
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    if (csrfRes.ok) {
      const body = (await csrfRes.json()) as { result?: string };
      csrfToken = body.result ?? "";
      const extra = collectCookies(csrfRes);
      if (extra) cookie = cookie ? `${cookie}; ${extra}` : extra;
    }
  } catch {
    // CSRF là tuỳ chọn với một số cấu hình Superset.
  }

  const session: Session = {
    accessToken: login.access_token,
    csrfToken,
    cookie,
    expiresAt: Date.now() + 4 * 60 * 1000,
  };
  sessionCache.set(key, session);
  return session;
}

export async function supersetFetch(
  creds: SupersetCreds,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = normalizeBaseUrl(creds.baseUrl);
  const session = await getSupersetSession(creds);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (session.csrfToken) headers.set("X-CSRFToken", session.csrfToken);
  if (session.cookie) headers.set("Cookie", session.cookie);
  headers.set("Referer", base);

  return fetch(`${base}${path}`, { ...init, headers });
}

export type SupersetChartSummary = {
  id: number;
  name: string;
  vizType: string;
  datasource: string;
  changedOn: string | null;
};

export async function listSupersetCharts(
  creds: SupersetCreds,
  search: string,
  pageSize = 100,
): Promise<SupersetChartSummary[]> {
  const q: Record<string, unknown> = {
    columns: ["id", "slice_name", "viz_type", "datasource_name_text", "changed_on_delta_humanized"],
    order_column: "slice_name",
    order_direction: "asc",
    page_size: pageSize,
  };
  if (search.trim()) {
    q["filters"] = [{ col: "slice_name", opr: "ct", value: search.trim() }];
  }
  const res = await supersetFetch(
    creds,
    `/api/v1/chart/?q=${encodeURIComponent(JSON.stringify(q))}`,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Không lấy được danh sách biểu đồ (${res.status}). ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    result?: Array<{
      id: number;
      slice_name?: string;
      viz_type?: string;
      datasource_name_text?: string;
      changed_on_delta_humanized?: string;
    }>;
  };
  return (body.result ?? []).map((c) => ({
    id: c.id,
    name: c.slice_name ?? `Chart #${c.id}`,
    vizType: c.viz_type ?? "unknown",
    datasource: c.datasource_name_text ?? "",
    changedOn: c.changed_on_delta_humanized ?? null,
  }));
}

export type ChartDataResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  vizType: string | null;
};

export async function fetchSupersetChartData(
  creds: SupersetCreds,
  chartId: number,
  rowLimit: number,
): Promise<ChartDataResult> {
  const res = await supersetFetch(creds, `/api/v1/chart/${chartId}/data/?format=json&type=full`, {
    method: "GET",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Không lấy được dữ liệu biểu đồ #${chartId} (${res.status}). ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    result?: Array<{
      data?: Array<Record<string, unknown>>;
      colnames?: string[];
      query?: string;
    }>;
  };
  const first = body.result?.[0];
  const rows = (first?.data ?? []).slice(0, rowLimit);
  const columns =
    first?.colnames && first.colnames.length > 0
      ? first.colnames
      : rows.length > 0
        ? Object.keys(rows[0]!)
        : [];
  return { columns, rows, vizType: null };
}

export async function createGuestToken(
  creds: SupersetCreds,
  embedUuid: string,
  rlsClauses: string[],
  username: string,
): Promise<string> {
  const res = await supersetFetch(creds, `/api/v1/security/guest_token/`, {
    method: "POST",
    body: JSON.stringify({
      user: { username, first_name: "Report", last_name: "Viewer" },
      resources: [{ type: "dashboard", id: embedUuid }],
      rls: rlsClauses.map((clause) => ({ clause })),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Không tạo được guest token (${res.status}). ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error("Superset không trả về guest token.");
  return body.token;
}

export async function pingSuperset(creds: SupersetCreds): Promise<{
  ok: boolean;
  message: string;
  version?: string;
}> {
  try {
    const res = await supersetFetch(creds, `/api/v1/me/`);
    if (!res.ok) {
      return { ok: false, message: `Máy chủ trả về ${res.status}` };
    }
    const me = (await res.json()) as { result?: { username?: string } };
    return {
      ok: true,
      message: `Kết nối thành công với tài khoản "${me.result?.username ?? creds.username}"`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Lỗi không xác định" };
  }
}
