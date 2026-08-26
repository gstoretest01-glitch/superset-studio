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
};

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
