import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const connectionInput = z.object({ connectionId: z.string().uuid() });

const AGGREGATES = ["SUM", "COUNT", "AVG", "MIN", "MAX", "COUNT_DISTINCT"] as const;
export const adhocMetricSchema = z.union([
  z.object({ column: z.string().min(1), aggregate: z.enum(AGGREGATES), label: z.string().optional() }),
  z.object({ savedMetric: z.string().min(1) }),
]);

/** Kiểm tra kết nối tới máy chủ Superset đã cấu hình. */
export const testSupersetConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => connectionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { resolveCreds } = await import("./superset-creds.server");
    const { pingSuperset } = await import("./superset.server");
    const creds = await resolveCreds(context.supabase, data.connectionId);
    if ("error" in creds) return { ok: false, message: creds.error };
    const result = await pingSuperset(creds);
    await context.supabase
      .from("superset_connections")
      .update({
        last_checked_at: new Date().toISOString(),
        last_status: result.ok ? "ok" : `error: ${result.message}`,
      })
      .eq("id", data.connectionId);
    return result;
  });

/** Danh mục biểu đồ có sẵn trên Superset để chọn vào báo cáo. */
export const listCharts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    connectionInput.extend({ search: z.string().default("") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveCreds } = await import("./superset-creds.server");
    const { listSupersetCharts } = await import("./superset.server");
    const creds = await resolveCreds(context.supabase, data.connectionId);
    if ("error" in creds) return { charts: [], error: creds.error };
    try {
      return { charts: await listSupersetCharts(creds, data.search), error: null };
    } catch (err) {
      return { charts: [], error: err instanceof Error ? err.message : "Lỗi không xác định" };
    }
  });

/** Dữ liệu thô của một biểu đồ để tự render responsive. */
export const getChartData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    connectionInput
      .extend({ chartId: z.number().int().positive(), rowLimit: z.number().int().min(1).max(5000).default(500) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveCreds } = await import("./superset-creds.server");
    const { fetchSupersetChartData } = await import("./superset.server");
    const creds = await resolveCreds(context.supabase, data.connectionId);
    if ("error" in creds) return { columns: [], rows: [], error: creds.error };
    try {
      const res = await fetchSupersetChartData(creds, data.chartId, data.rowLimit);
      return { ...res, error: null };
    } catch (err) {
      return {
        columns: [],
        rows: [],
        error: err instanceof Error ? err.message : "Lỗi không xác định",
      };
    }
  });

/** Danh mục tập dữ liệu (dataset) Superset để tạo biểu đồ mới ngay trong app. */
export const listDatasets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    connectionInput.extend({ search: z.string().default("") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveCreds } = await import("./superset-creds.server");
    const { listSupersetDatasets } = await import("./superset.server");
    const creds = await resolveCreds(context.supabase, data.connectionId);
    if ("error" in creds) return { datasets: [], error: creds.error };
    try {
      return { datasets: await listSupersetDatasets(creds, data.search), error: null };
    } catch (err) {
      return { datasets: [], error: err instanceof Error ? err.message : "Lỗi không xác định" };
    }
  });

/** Cột + metric có sẵn của một tập dữ liệu, để chọn dimension/metric khi tạo biểu đồ mới. */
export const getDatasetDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    connectionInput.extend({ datasetId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveCreds } = await import("./superset-creds.server");
    const { getSupersetDatasetDetail } = await import("./superset.server");
    const creds = await resolveCreds(context.supabase, data.connectionId);
    if ("error" in creds) return { detail: null, error: creds.error };
    try {
      return { detail: await getSupersetDatasetDetail(creds, data.datasetId), error: null };
    } catch (err) {
      return { detail: null, error: err instanceof Error ? err.message : "Lỗi không xác định" };
    }
  });

/** Dữ liệu biểu đồ dựng trực tiếp từ dataset + cột chọn (không cần chart có sẵn trong Superset). */
export const getAdhocChartData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    connectionInput
      .extend({
        datasetId: z.number().int().positive(),
        groupby: z.array(z.string()).default([]),
        metrics: z.array(adhocMetricSchema).default([]),
        rowLimit: z.number().int().min(1).max(5000).default(500),
        orderDesc: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveCreds } = await import("./superset-creds.server");
    const { fetchAdhocChartData } = await import("./superset.server");
    const creds = await resolveCreds(context.supabase, data.connectionId);
    if ("error" in creds) return { columns: [], rows: [], error: creds.error };
    try {
      const res = await fetchAdhocChartData(creds, {
        datasetId: data.datasetId,
        groupby: data.groupby,
        metrics: data.metrics,
        rowLimit: data.rowLimit,
        orderDesc: data.orderDesc,
      });
      return { ...res, error: null };
    } catch (err) {
      return {
        columns: [],
        rows: [],
        error: err instanceof Error ? err.message : "Lỗi không xác định",
      };
    }
  });

/** Guest token cho dashboard nhúng (chế độ iframe). */
export const getGuestToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    connectionInput.extend({ embedUuid: z.string().min(8) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveCreds } = await import("./superset-creds.server");
    const { createGuestToken } = await import("./superset.server");
    const creds = await resolveCreds(context.supabase, data.connectionId);
    if ("error" in creds) return { token: null, error: creds.error };
    try {
      const token = await createGuestToken(creds, data.embedUuid, [], `u_${context.userId.slice(0, 8)}`);
      return { token, error: null };
    } catch (err) {
      return { token: null, error: err instanceof Error ? err.message : "Lỗi không xác định" };
    }
  });

/** Dữ liệu biểu đồ cho báo cáo đã xuất bản — dùng cho link chia sẻ công khai. */
export const getPublicBlockData = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ blockId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { resolvePublicBlockContext } = await import("./superset-creds.server");
    const { fetchSupersetChartData, fetchAdhocChartData } = await import("./superset.server");

    const ctx = await resolvePublicBlockContext(data.blockId);
    if ("error" in ctx) return { columns: [], rows: [], error: ctx.error };

    try {
      const res =
        ctx.kind === "adhoc"
          ? await fetchAdhocChartData(ctx.creds, {
              datasetId: ctx.datasetId,
              groupby: ctx.groupby,
              metrics: ctx.metrics,
              rowLimit: ctx.rowLimit,
              orderDesc: ctx.orderDesc,
            })
          : await fetchSupersetChartData(ctx.creds, ctx.chartId, ctx.rowLimit);
      return { ...res, error: null };
    } catch (err) {
      return {
        columns: [],
        rows: [],
        error: err instanceof Error ? err.message : "Lỗi không xác định",
      };
    }
  });
