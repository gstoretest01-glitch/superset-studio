import type { SupabaseClient } from "@supabase/supabase-js";

import type { SupersetCreds } from "./superset.server";

type ConnRow = {
  base_url: string;
  service_username: string;
  auth_provider: string;
} | null;

export function credsFromConnectionRow(
  conn: ConnRow,
): SupersetCreds | { error: string } {
  if (!conn) return { error: "Không tìm thấy kết nối Superset." };
  const password = process.env["SUPERSET_SERVICE_PASSWORD"];
  const username = conn.service_username || process.env["SUPERSET_SERVICE_USER"] || "";
  if (!password || !username) {
    return {
      error:
        "Thiếu tài khoản dịch vụ Superset. Hãy lưu SUPERSET_SERVICE_USER và SUPERSET_SERVICE_PASSWORD trong phần bí mật của dự án.",
    };
  }
  if (!conn.base_url) return { error: "Kết nối chưa có địa chỉ máy chủ Superset." };
  return {
    baseUrl: conn.base_url,
    username,
    password,
    provider: conn.auth_provider || "db",
  };
}

export async function resolveCreds(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<SupersetCreds | { error: string }> {
  const { data, error } = await supabase
    .from("superset_connections")
    .select("base_url, service_username, auth_provider")
    .eq("id", connectionId)
    .maybeSingle();
  if (error) return { error: error.message };
  return credsFromConnectionRow(data as ConnRow);
}

export type PublicBlockContext =
  | { kind: "chart"; chartId: number; rowLimit: number; creds: SupersetCreds }
  | {
      kind: "adhoc";
      datasetId: number;
      groupby: string[];
      metrics: import("./superset.server").AdhocMetric[];
      rowLimit: number;
      orderDesc: boolean;
      creds: SupersetCreds;
    }
  | { error: string };

/** Ngữ cảnh của một khối thuộc báo cáo đã xuất bản (dùng cho link công khai). */
export async function resolvePublicBlockContext(blockId: string): Promise<PublicBlockContext> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("get_public_block_context", {
    _block_id: blockId,
  });
  if (error) return { error: error.message };
  // Kiểu trả về RPC trong types.ts chưa có các cột adhoc_* — Lovable Cloud sẽ tự cập nhật
  // sau khi migration 20260826110000 được áp dụng. Cast tường minh tạm thời.
  const row = (Array.isArray(data) ? data[0] : null) as
    | {
        block_type: string;
        chart_id: number | null;
        row_limit: number;
        dataset_id: number | null;
        adhoc_metrics: unknown;
        adhoc_groupby: unknown;
        adhoc_order_desc: boolean;
        base_url: string;
        service_username: string;
        auth_provider: string;
      }
    | null;
  if (!row) return { error: "Báo cáo chưa xuất bản hoặc khối không tồn tại." };
  const creds = credsFromConnectionRow({
    base_url: row.base_url,
    service_username: row.service_username,
    auth_provider: row.auth_provider,
  });
  if ("error" in creds) return creds;

  if (row.block_type === "adhoc_query") {
    if (row.dataset_id == null) return { error: "Khối chưa gắn tập dữ liệu." };
    const { adhocMetricSchema } = await import("./superset.functions");
    const parsed = adhocMetricSchema.array().safeParse(row.adhoc_metrics);
    const groupbyParsed = Array.isArray(row.adhoc_groupby) ? (row.adhoc_groupby as string[]) : [];
    return {
      kind: "adhoc",
      datasetId: row.dataset_id,
      groupby: groupbyParsed,
      metrics: parsed.success ? parsed.data : [],
      rowLimit: row.row_limit,
      orderDesc: row.adhoc_order_desc,
      creds,
    };
  }

  if (row.chart_id == null) return { error: "Khối chưa gắn biểu đồ." };
  return { kind: "chart", chartId: row.chart_id, rowLimit: row.row_limit, creds };
}
