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

/** Ngữ cảnh của một khối thuộc báo cáo đã xuất bản (dùng cho link công khai). */
export async function resolvePublicBlockContext(blockId: string): Promise<
  | { chartId: number; rowLimit: number; creds: SupersetCreds }
  | { error: string }
> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("get_public_block_context", {
    _block_id: blockId,
  });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { error: "Báo cáo chưa xuất bản hoặc khối không tồn tại." };
  const creds = credsFromConnectionRow({
    base_url: row.base_url,
    service_username: row.service_username,
    auth_provider: row.auth_provider,
  });
  if ("error" in creds) return creds;
  return { chartId: row.chart_id, rowLimit: row.row_limit, creds };
}
