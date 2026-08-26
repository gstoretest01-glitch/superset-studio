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
  rows: Array<Record<string, string | number | boolean | null>>;
  vizType: string | null;
};

type ChartDataApiBody = {
  result?: Array<{
    data?: Array<Record<string, string | number | boolean | null>>;
    colnames?: string[];
    query?: string;
    status?: string;
    error?: string;
  }>;
};

function parseChartDataResponse(body: ChartDataApiBody, rowLimit: number): ChartDataResult {
  const first = body.result?.[0];
  if (first?.status === "error") {
    throw new Error(first.error ?? "Superset trả về lỗi khi truy vấn dữ liệu.");
  }
  const rows = (first?.data ?? []).slice(0, rowLimit);
  const columns =
    first?.colnames && first.colnames.length > 0
      ? first.colnames
      : rows.length > 0
        ? Object.keys(rows[0]!)
        : [];
  return { columns, rows, vizType: null };
}

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
  const body = (await res.json()) as ChartDataApiBody;
  return parseChartDataResponse(body, rowLimit);
}

export type SupersetDatasetSummary = {
  id: number;
  name: string;
  database: string;
  schema: string | null;
};

export async function listSupersetDatasets(
  creds: SupersetCreds,
  search: string,
  pageSize = 100,
): Promise<SupersetDatasetSummary[]> {
  const q: Record<string, unknown> = {
    columns: ["id", "table_name", "schema", "database.database_name"],
    order_column: "table_name",
    order_direction: "asc",
    page_size: pageSize,
  };
  if (search.trim()) {
    q["filters"] = [{ col: "table_name", opr: "ct", value: search.trim() }];
  }
  const res = await supersetFetch(creds, `/api/v1/dataset/?q=${encodeURIComponent(JSON.stringify(q))}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Không lấy được danh sách tập dữ liệu (${res.status}). ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    result?: Array<{
      id: number;
      table_name?: string;
      schema?: string | null;
      database?: { database_name?: string };
    }>;
  };
  return (body.result ?? []).map((d) => ({
    id: d.id,
    name: d.table_name ?? `Dataset #${d.id}`,
    database: d.database?.database_name ?? "",
    schema: d.schema ?? null,
  }));
}

export type SupersetDatasetColumn = {
  name: string;
  type: string;
  groupby: boolean;
  filterable: boolean;
  isDttm: boolean;
};

export type SupersetDatasetMetric = {
  name: string;
  label: string;
  expression: string;
};

export type SupersetDatasetDetail = {
  id: number;
  name: string;
  datasourceType: string;
  columns: SupersetDatasetColumn[];
  metrics: SupersetDatasetMetric[];
  mainDttmCol: string | null;
};

export async function getSupersetDatasetDetail(
  creds: SupersetCreds,
  datasetId: number,
): Promise<SupersetDatasetDetail> {
  const res = await supersetFetch(creds, `/api/v1/dataset/${datasetId}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Không lấy được chi tiết tập dữ liệu #${datasetId} (${res.status}). ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    result?: {
      table_name?: string;
      datasource_type?: string;
      main_dttm_col?: string | null;
      columns?: Array<{
        column_name: string;
        type?: string | null;
        groupby?: boolean;
        filterable?: boolean;
        is_dttm?: boolean;
      }>;
      metrics?: Array<{ metric_name: string; verbose_name?: string | null; expression?: string }>;
    };
  };
  const result = body.result;
  return {
    id: datasetId,
    name: result?.table_name ?? `Dataset #${datasetId}`,
    datasourceType: result?.datasource_type ?? "table",
    mainDttmCol: result?.main_dttm_col ?? null,
    columns: (result?.columns ?? []).map((c) => ({
      name: c.column_name,
      type: c.type ?? "",
      groupby: c.groupby ?? false,
      filterable: c.filterable ?? false,
      isDttm: c.is_dttm ?? false,
    })),
    metrics: (result?.metrics ?? []).map((m) => ({
      name: m.metric_name,
      label: m.verbose_name ?? m.metric_name,
      expression: m.expression ?? "",
    })),
  };
}

export type AdhocMetric =
  | { column: string; aggregate: "SUM" | "COUNT" | "AVG" | "MIN" | "MAX" | "COUNT_DISTINCT"; label?: string | undefined }
  | { savedMetric: string };

function buildMetricPayload(metric: AdhocMetric): unknown {
  if ("savedMetric" in metric) return metric.savedMetric;
  return {
    expressionType: "SIMPLE",
    column: { column_name: metric.column },
    aggregate: metric.aggregate,
    label: metric.label ?? `${metric.aggregate}(${metric.column})`,
  };
}

function metricLabel(metric: AdhocMetric): string {
  if ("savedMetric" in metric) return metric.savedMetric;
  return metric.label ?? `${metric.aggregate}(${metric.column})`;
}

export async function fetchAdhocChartData(
  creds: SupersetCreds,
  params: {
    datasetId: number;
    groupby: string[];
    metrics: AdhocMetric[];
    rowLimit: number;
    orderDesc?: boolean;
    filters?: Array<{ col: string; op: string; val: unknown }>;
  },
): Promise<ChartDataResult> {
  const orderCol = params.metrics[0] ? metricLabel(params.metrics[0]) : null;
  const payload = {
    datasource: { id: params.datasetId, type: "table" },
    queries: [
      {
        columns: params.groupby,
        groupby: params.groupby,
        metrics: params.metrics.map(buildMetricPayload),
        row_limit: params.rowLimit,
        ...(orderCol ? { orderby: [[orderCol, !(params.orderDesc ?? true)]] } : {}),
        ...(params.filters && params.filters.length > 0
          ? { filters: params.filters.map((f) => ({ col: f.col, op: f.op, val: f.val })) }
          : {}),
      },
    ],
    result_format: "json",
    result_type: "full",
  };
  const res = await supersetFetch(creds, `/api/v1/chart/data`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Không lấy được dữ liệu biểu đồ (${res.status}). ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as ChartDataApiBody;
  return parseChartDataResponse(body, params.rowLimit);
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
    // Lưu ý: /api/v1/me/ trả 401 kể cả với admin trên một số bản Superset 6.0.0
    // (permission CurrentUserRestApi không được gán mặc định). Dùng /api/v1/chart/
    // với page_size=0 để xác nhận phiên đăng nhập hợp lệ mà không phụ thuộc endpoint đó.
    const res = await supersetFetch(creds, `/api/v1/chart/?q=(page_size:1)`);
    if (!res.ok) {
      return { ok: false, message: `Máy chủ trả về ${res.status}` };
    }
    return {
      ok: true,
      message: `Kết nối thành công với tài khoản "${creds.username}"`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Lỗi không xác định" };
  }
}
