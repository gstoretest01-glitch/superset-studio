import type { Json } from "@/integrations/supabase/types";
export type ReportTheme = {
  id: string;
  name: string;
  description: string | null;
  palette: string[];
  surface_color: string;
  page_color: string;
  text_color: string;
  muted_text_color: string;
  border_color: string;
  accent_color: string;
  font_family: string;
  radius_px: number;
  gap_px: number;
  is_default: boolean;
};

export type ReportBlock = {
  id: string;
  report_id: string;
  block_type: string;
  render_mode: string;
  chart_id: number | null;
  chart_name: string | null;
  chart_kind: string;
  embed_uuid: string | null;
  row_limit: number;
  title: string | null;
  body: string | null;
  position: number;
  span_lg: number;
  span_md: number;
  span_sm: number;
  height_px: number;
  height_sm_px: number;
  hide_on_mobile: boolean;
  show_title: boolean;
  background_color: string | null;
  border_color: string | null;
  radius_px: number | null;
  padding_px: number;
  style_config: Json;
  layout: Json;
  dataset_id: number | null;
  dataset_name: string | null;
  adhoc_metrics: Json;
  adhoc_groupby: Json;
  adhoc_filters: Json;
  adhoc_order_desc: boolean;
};

/** Vị trí/kích thước tự do trên lưới (đơn vị: cột 0-11 cho x/w, hàng 20px cho y/h). */
export type GridPos = { x: number; y: number; w: number; h: number };
export type Breakpoint = "lg" | "md" | "sm";
export type BlockLayout = Partial<Record<Breakpoint, GridPos>>;

const LAYOUT_ROW_PX = 20;

function fallbackPos(block: ReportBlock, bp: Breakpoint): GridPos {
  const w = bp === "lg" ? block.span_lg : bp === "md" ? block.span_md : block.span_sm;
  const heightPx = bp === "sm" ? block.height_sm_px : block.height_px;
  return {
    x: 0,
    y: block.position * Math.max(1, Math.ceil(block.height_px / LAYOUT_ROW_PX)),
    w: Math.min(12, Math.max(1, w)),
    h: Math.max(1, Math.ceil(heightPx / LAYOUT_ROW_PX)),
  };
}

function isGridPos(v: unknown): v is GridPos {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return typeof p["x"] === "number" && typeof p["y"] === "number" && typeof p["w"] === "number" && typeof p["h"] === "number";
}

/** Trộn `layout` lưu trong DB với vị trí suy ra từ cột cũ (span/height/position) khi thiếu. */
export function resolveLayout(raw: unknown, block: ReportBlock): BlockLayout {
  const stored = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: BlockLayout = {};
  for (const bp of ["lg", "md", "sm"] as const) {
    const v = stored[bp];
    out[bp] = isGridPos(v) ? v : fallbackPos(block, bp);
  }
  return out;
}

export type Report = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  theme_id: string | null;
  connection_id: string | null;
  is_published: boolean;
  grid_columns: number;
  max_width_px: number;
  updated_at: string;
};

export const CHART_KINDS = [
  { value: "auto", label: "Tự động" },
  { value: "bar", label: "Cột" },
  { value: "line", label: "Đường" },
  { value: "area", label: "Vùng" },
  { value: "pie", label: "Tròn" },
  { value: "kpi", label: "Số KPI" },
  { value: "table", label: "Bảng" },
] as const;

export const FALLBACK_THEME: ReportTheme = {
  id: "fallback",
  name: "Mặc định",
  description: null,
  palette: ["#2dd4bf", "#f59e0b", "#60a5fa", "#f472b6", "#a3e635", "#fb7185", "#38bdf8", "#facc15"],
  surface_color: "#111820",
  page_color: "#0b0f14",
  text_color: "#e6edf3",
  muted_text_color: "#8b98a5",
  border_color: "#1f2a35",
  accent_color: "#2dd4bf",
  font_family: "Inter",
  radius_px: 14,
  gap_px: 16,
  is_default: true,
};

export function isNumeric(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

/** Suy luận trục x và các chuỗi số từ bảng dữ liệu trả về từ Superset. */
export type ChartRow = Record<string, string | number | boolean | null>;

export function inferSeries(columns: string[], rows: ChartRow[]) {
  if (rows.length === 0) return { xKey: columns[0] ?? "", numericKeys: [] as string[] };
  const first = rows[0]!;
  const numericKeys = columns.filter((c) => isNumeric(first[c]));
  const xKey = columns.find((c) => !numericKeys.includes(c)) ?? columns[0] ?? "";
  return { xKey, numericKeys };
}

export function formatNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} tr`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)} k`;
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
}
