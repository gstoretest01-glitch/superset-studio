import type { ReportTheme } from "./report-types";

/** Cấu hình giao diện riêng của từng khối biểu đồ (lưu ở cột `style_config`). */
export type BlockStyle = {
  /* Chung */
  paletteMode: "theme" | "custom";
  palette: string[];
  legend: "auto" | "on" | "off";
  legendPosition: "top" | "bottom" | "right";
  tooltip: boolean;
  emptyText: string;
  decimals: number;
  compact: boolean;
  prefix: string;
  suffix: string;
  titleAlign: "left" | "center" | "right";
  titleSize: number;
  titleColor: string | null;
  subtitle: string;

  /* Trục */
  showXAxis: boolean;
  showYAxis: boolean;
  xLabelAngle: number;
  axisTitleX: string;
  axisTitleY: string;
  grid: "none" | "horizontal" | "vertical" | "both";
  yMin: number | null;
  yMax: number | null;

  /* Cột */
  barOrientation: "vertical" | "horizontal";
  barStack: "none" | "stacked" | "percent";
  barRadius: number;
  barSize: number | null;
  barLabels: boolean;
  sort: "none" | "desc" | "asc";
  topN: number | null;

  /* Đường */
  lineWidth: number;
  lineDashed: boolean;
  lineCurve: "monotone" | "linear" | "step";
  lineDots: boolean;

  /* Vùng */
  areaOpacity: number;

  /* Tròn */
  donutRatio: number;
  padAngle: number;
  pieLabels: "none" | "percent" | "value";
  pieTotal: boolean;

  /* KPI */
  kpiLabel: string;
  kpiSize: number;
  kpiColor: string | null;
  kpiAlign: "left" | "center";

  /* Bảng */
  tableStriped: boolean;
  tableDense: boolean;
  tableBars: boolean;
  tableColumns: string[] | null;
};

export const DEFAULT_BLOCK_STYLE: BlockStyle = {
  paletteMode: "theme",
  palette: [],
  legend: "auto",
  legendPosition: "bottom",
  tooltip: true,
  emptyText: "Không có dữ liệu",
  decimals: 2,
  compact: true,
  prefix: "",
  suffix: "",
  titleAlign: "left",
  titleSize: 14,
  titleColor: null,
  subtitle: "",

  showXAxis: true,
  showYAxis: true,
  xLabelAngle: 0,
  axisTitleX: "",
  axisTitleY: "",
  grid: "horizontal",
  yMin: null,
  yMax: null,

  barOrientation: "vertical",
  barStack: "none",
  barRadius: 4,
  barSize: null,
  barLabels: false,
  sort: "none",
  topN: null,

  lineWidth: 2,
  lineDashed: false,
  lineCurve: "monotone",
  lineDots: false,

  areaOpacity: 0.22,

  donutRatio: 45,
  padAngle: 2,
  pieLabels: "none",
  pieTotal: false,

  kpiLabel: "",
  kpiSize: 40,
  kpiColor: null,
  kpiAlign: "left",

  tableStriped: false,
  tableDense: false,
  tableBars: false,
  tableColumns: null,
};

/** Trộn cấu hình lưu trong DB với giá trị mặc định. */
export function resolveStyle(raw: unknown): BlockStyle {
  if (!raw || typeof raw !== "object") return DEFAULT_BLOCK_STYLE;
  return { ...DEFAULT_BLOCK_STYLE, ...(raw as Partial<BlockStyle>) };
}

export function stylePalette(style: BlockStyle, theme: ReportTheme): string[] {
  if (style.paletteMode === "custom" && style.palette.length > 0) return style.palette;
  return theme.palette.length > 0 ? theme.palette : ["#2dd4bf"];
}

/** Bộ định dạng số theo cấu hình của khối. */
export function makeFormatter(style: BlockStyle) {
  return (value: number): string => {
    if (!Number.isFinite(value)) return "";
    let body: string;
    const abs = Math.abs(value);
    if (style.compact && abs >= 1_000) {
      const [div, unit] =
        abs >= 1_000_000_000
          ? [1_000_000_000, " tỷ"]
          : abs >= 1_000_000
            ? [1_000_000, " tr"]
            : [1_000, " k"];
      body = `${(value / div).toFixed(1)}${unit}`;
    } else {
      body = new Intl.NumberFormat("vi-VN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: style.decimals,
      }).format(value);
    }
    return `${style.prefix}${body}${style.suffix}`;
  };
}

/** Áp sắp xếp và giới hạn top-N lên dữ liệu trước khi vẽ. */
export function applyDataShaping<T extends Record<string, unknown>>(
  rows: T[],
  metricKey: string | undefined,
  style: BlockStyle,
): T[] {
  let out = rows;
  if (metricKey && style.sort !== "none") {
    out = [...out].sort((a, b) => {
      const av = Number(a[metricKey] ?? 0);
      const bv = Number(b[metricKey] ?? 0);
      return style.sort === "desc" ? bv - av : av - bv;
    });
  }
  if (style.topN && style.topN > 0 && out.length > style.topN) {
    out = out.slice(0, style.topN);
  }
  return out;
}
