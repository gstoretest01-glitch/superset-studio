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
const GRID_COLS = 12;

function isGridPos(v: unknown): v is GridPos {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return typeof p["x"] === "number" && typeof p["y"] === "number" && typeof p["w"] === "number" && typeof p["h"] === "number";
}

/** Đọc `layout[bp]` đã lưu trong DB cho 1 breakpoint. `null` nếu chưa có (không đoán mò). */
export function resolveLayout(raw: unknown, bp: Breakpoint): GridPos | null {
  const stored = raw && typeof raw === "object" ? (raw as Record<string, unknown>)[bp] : undefined;
  return isGridPos(stored) ? stored : null;
}

function collides(a: GridPos, b: GridPos): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Tìm ô trống đầu tiên (quét từ hàng 0, cột 0) không va chạm với bất kỳ layout nào đã có.
 * Đây là thuật toán auto-placement duy nhất trong hệ thống — chạy MỘT LẦN khi tạo/backfill
 * block, kết quả luôn được lưu tường minh vào `layout`. Không có suy luận lại khi render.
 */
export function findFreePosition(existing: GridPos[], w: number, h: number, cols = GRID_COLS): GridPos {
  const width = Math.min(cols, Math.max(1, w));
  for (let y = 0; y < 100_000; y++) {
    for (let x = 0; x <= cols - width; x++) {
      const candidate: GridPos = { x, y, w: width, h };
      if (!existing.some((e) => collides(candidate, e))) return candidate;
    }
  }
  return { x: 0, y: existing.reduce((m, e) => Math.max(m, e.y + e.h), 0), w: width, h };
}

/** Kích thước mặc định (đơn vị lưới) theo loại khối, dùng khi tạo block mới. */
export function defaultBlockSize(blockType: string): { w: number; h: number } {
  if (blockType === "heading") return { w: 12, h: 5 };
  if (blockType === "text") return { w: 12, h: 8 };
  if (blockType === "divider") return { w: 12, h: 2 };
  if (blockType === "tabs" || blockType === "row" || blockType === "column") return { w: 12, h: 17 };
  return { w: 6, h: 17 }; // superset_chart / adhoc_query
}

/**
 * Tính layout đầy đủ (lg/md/sm) cho MỘT block mới, tránh va chạm với layout hiện có của các
 * block khác trong báo cáo. `others` phải là layout đã resolve (đầy đủ) của các block anh em.
 */
export function planNewBlockLayout(blockType: string, others: BlockLayout[]): BlockLayout {
  const { w, h } = defaultBlockSize(blockType);
  const out: BlockLayout = {};
  for (const bp of ["lg", "md", "sm"] as const) {
    const existing = others.map((o) => o[bp]).filter((p): p is GridPos => p != null);
    const width = bp === "sm" ? GRID_COLS : w;
    out[bp] = findFreePosition(existing, width, h);
  }
  return out;
}

/**
 * Trả về layout đầy đủ (lg/md/sm) cho TOÀN BỘ block của một báo cáo. Block đã có `layout` lưu
 * sẵn giữ nguyên; block còn thiếu (dữ liệu cũ trước khi có auto-placement) được backfill bằng
 * `findFreePosition` theo đúng thứ tự `position`, tính against layout đã resolve của các block
 * đứng trước — không còn nhánh "suy luận từ span/height" mập mờ như trước.
 */
export function resolveReportLayout(blocks: ReportBlock[]): Map<string, BlockLayout> {
  const sorted = [...blocks].sort((a, b) => a.position - b.position);
  const out = new Map<string, BlockLayout>();

  for (const bp of ["lg", "md", "sm"] as const) {
    const placed: GridPos[] = [];
    for (const block of sorted) {
      const stored = resolveLayout(block.layout, bp);
      const size = defaultBlockSize(block.block_type);
      const width = bp === "sm" ? GRID_COLS : size.w;
      const pos = stored ?? findFreePosition(placed, width, size.h);
      placed.push(pos);
      const current = out.get(block.id) ?? {};
      current[bp] = pos;
      out.set(block.id, current);
    }
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
