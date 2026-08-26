import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  applyDataShaping,
  makeFormatter,
  resolveStyle,
  stylePalette,
  type BlockStyle,
} from "@/lib/block-style";
import { inferSeries, type ChartRow, type ReportTheme } from "@/lib/report-types";

type Props = {
  kind: string;
  columns: string[];
  rows: ChartRow[];
  theme: ReportTheme;
  compact?: boolean;
  style?: BlockStyle | unknown;
};

function pickKind(kind: string, numericCount: number, rowCount: number) {
  if (kind !== "auto") return kind;
  if (rowCount === 1 && numericCount === 1) return "kpi";
  if (numericCount === 0) return "table";
  if (rowCount > 24) return "line";
  return "bar";
}

export function ChartRenderer({ kind, columns, rows: rawRows, theme, compact, style: rawStyle }: Props) {
  const style = resolveStyle(rawStyle);
  const fmt = makeFormatter(style);
  const { xKey, numericKeys } = inferSeries(columns, rawRows);
  const resolved = pickKind(kind, numericKeys.length, rawRows.length);
  const palette = stylePalette(style, theme);

  let rows = applyDataShaping(rawRows, numericKeys[0], style);

  if (style.barStack === "percent" && numericKeys.length > 1) {
    rows = rows.map((r) => {
      const total = numericKeys.reduce((s, k) => s + Number(r[k] ?? 0), 0) || 1;
      const next: ChartRow = { ...r };
      for (const k of numericKeys) next[k] = (Number(r[k] ?? 0) / total) * 100;
      return next;
    });
  }

  const axisStyle = { fill: theme.muted_text_color, fontSize: compact ? 10 : 11 };
  const tooltipStyle = {
    background: theme.surface_color,
    border: `1px solid ${theme.border_color}`,
    borderRadius: 10,
    color: theme.text_color,
    fontSize: 12,
  };
  const showLegend =
    style.legend === "on" || (style.legend === "auto" && numericKeys.length > 1 && !compact);
  const legendProps = {
    verticalAlign: style.legendPosition === "top" ? ("top" as const) : ("bottom" as const),
    align: style.legendPosition === "right" ? ("right" as const) : ("center" as const),
    layout: style.legendPosition === "right" ? ("vertical" as const) : ("horizontal" as const),
    wrapperStyle: { fontSize: 11, color: theme.muted_text_color },
  };

  if (rows.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center text-xs"
        style={{ color: theme.muted_text_color }}
      >
        {style.emptyText}
      </div>
    );
  }

  if (resolved === "kpi") {
    const metric = numericKeys[0] ?? columns[0]!;
    const value = Number(rows[0]?.[metric] ?? 0);
    return (
      <div
        className="flex h-full flex-col justify-center gap-1"
        style={{ alignItems: style.kpiAlign === "center" ? "center" : "flex-start" }}
      >
        <span
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ color: theme.muted_text_color }}
        >
          {style.kpiLabel || metric}
        </span>
        <span
          className="font-semibold tabular-nums"
          style={{
            color: style.kpiColor ?? theme.accent_color,
            fontFamily: theme.font_family,
            fontSize: `${style.kpiSize}px`,
            lineHeight: 1.1,
          }}
        >
          {fmt(value)}
        </span>
        {style.subtitle && (
          <span className="text-xs" style={{ color: theme.muted_text_color }}>
            {style.subtitle}
          </span>
        )}
      </div>
    );
  }

  if (resolved === "table") {
    const cols = style.tableColumns?.length ? style.tableColumns.filter((c) => columns.includes(c)) : columns;
    const maxByCol = new Map<string, number>();
    if (style.tableBars) {
      for (const c of cols) {
        maxByCol.set(c, Math.max(...rows.map((r) => (typeof r[c] === "number" ? Math.abs(r[c] as number) : 0)), 1));
      }
    }
    const pad = style.tableDense ? "px-2 py-1" : "px-2 py-1.5";
    return (
      <div className="scroll-thin h-full overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className={`sticky top-0 whitespace-nowrap text-left font-medium ${pad}`}
                  style={{
                    color: theme.muted_text_color,
                    background: theme.surface_color,
                    borderBottom: `1px solid ${theme.border_color}`,
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={style.tableStriped && i % 2 === 1 ? { background: `${theme.border_color}44` } : undefined}>
                {cols.map((c) => {
                  const isNum = typeof row[c] === "number";
                  const ratio =
                    style.tableBars && isNum
                      ? Math.min(1, Math.abs(row[c] as number) / (maxByCol.get(c) || 1))
                      : 0;
                  return (
                    <td
                      key={c}
                      className={`whitespace-nowrap tabular-nums ${pad}`}
                      style={{
                        color: theme.text_color,
                        borderBottom: `1px solid ${theme.border_color}`,
                        ...(ratio > 0
                          ? {
                              backgroundImage: `linear-gradient(to right, ${palette[0]}33 ${ratio * 100}%, transparent ${ratio * 100}%)`,
                            }
                          : {}),
                      }}
                    >
                      {isNum ? fmt(row[c] as number) : String(row[c] ?? "")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (resolved === "pie") {
    const metric = numericKeys[0] ?? columns[1] ?? columns[0]!;
    const data = rows.map((r) => ({
      name: String(r[xKey] ?? ""),
      value: Number(r[metric] ?? 0),
    }));
    const total = data.reduce((s, d) => s + d.value, 0);
    return (
      <div className="relative h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={`${style.donutRatio}%`}
              outerRadius="78%"
              paddingAngle={style.padAngle}
              label={
                style.pieLabels === "none"
                  ? false
                  : style.pieLabels === "percent"
                    ? (e: { value: number }) => `${((e.value / (total || 1)) * 100).toFixed(0)}%`
                    : (e: { value: number }) => fmt(e.value)
              }
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={palette[i % palette.length]} stroke={theme.surface_color} />
              ))}
            </Pie>
            {style.tooltip && <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />}
            {showLegend && <Legend {...legendProps} />}
          </PieChart>
        </ResponsiveContainer>
        {style.pieTotal && style.donutRatio > 20 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px]" style={{ color: theme.muted_text_color }}>Tổng</span>
            <span className="text-lg font-semibold tabular-nums" style={{ color: theme.text_color }}>
              {fmt(total)}
            </span>
          </div>
        )}
      </div>
    );
  }

  const horizontal = resolved === "bar" && style.barOrientation === "horizontal";
  const catAxisProps = {
    dataKey: xKey,
    tick: { ...axisStyle, angle: style.xLabelAngle, textAnchor: style.xLabelAngle ? ("end" as const) : ("middle" as const) },
    tickLine: false,
    axisLine: { stroke: theme.border_color },
    minTickGap: 8,
    hide: !style.showXAxis,
    ...(style.axisTitleX ? { label: { value: style.axisTitleX, position: "insideBottom" as const, offset: -4, fill: theme.muted_text_color, fontSize: 11 } } : {}),
  };
  const valAxisProps = {
    tick: axisStyle,
    tickLine: false,
    axisLine: false,
    hide: !style.showYAxis,
    tickFormatter: (v: number) => (style.barStack === "percent" ? `${v.toFixed(0)}%` : fmt(v)),
    domain: [style.yMin ?? ("auto" as const), style.yMax ?? ("auto" as const)] as [number | "auto", number | "auto"],
    ...(style.axisTitleY ? { label: { value: style.axisTitleY, angle: -90, position: "insideLeft" as const, fill: theme.muted_text_color, fontSize: 11 } } : {}),
  };

  const commonAxes = (
    <>
      {style.grid !== "none" && (
        <CartesianGrid
          stroke={theme.border_color}
          strokeDasharray="3 3"
          vertical={style.grid === "vertical" || style.grid === "both"}
          horizontal={style.grid === "horizontal" || style.grid === "both"}
        />
      )}
      {horizontal ? (
        <>
          <XAxis type="number" {...valAxisProps} />
          <YAxis type="category" width={compact ? 70 : 96} {...catAxisProps} />
        </>
      ) : (
        <>
          <XAxis {...catAxisProps} />
          <YAxis width={compact ? 34 : 48} {...valAxisProps} />
        </>
      )}
      {style.tooltip && (
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => (style.barStack === "percent" ? `${v.toFixed(1)}%` : fmt(v))}
          cursor={{ fill: `${theme.border_color}55` }}
        />
      )}
      {showLegend && <Legend {...legendProps} />}
    </>
  );

  const margin = { top: 8, right: 8, bottom: style.xLabelAngle ? 18 : 0, left: 0 };
  const stackId: string = style.barStack === "none" ? "" : "s";

  if (resolved === "line" || resolved === "area") {
    const Chart = resolved === "line" ? LineChart : AreaChart;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={rows} margin={margin}>
          {commonAxes}
          {numericKeys.map((k, i) =>
            resolved === "line" ? (
              <Line
                key={k}
                type={style.lineCurve}
                dataKey={k}
                stroke={palette[i % palette.length]}
                strokeWidth={style.lineWidth}
                strokeDasharray={style.lineDashed ? "5 4" : undefined}
                dot={style.lineDots ? { r: 2.5 } : false}
              />
            ) : (
              <Area
                key={k}
                type={style.lineCurve}
                dataKey={k}
                {...(stackId ? { stackId } : {})}
                stroke={palette[i % palette.length]}
                fill={palette[i % palette.length]}
                fillOpacity={style.areaOpacity}
                strokeWidth={style.lineWidth}
                dot={style.lineDots ? { r: 2.5 } : false}
              />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={margin} layout={horizontal ? "vertical" : "horizontal"}>
        {commonAxes}
        {numericKeys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            {...(stackId ? { stackId } : {})}
            fill={palette[i % palette.length]}
            radius={horizontal ? [0, style.barRadius, style.barRadius, 0] : [style.barRadius, style.barRadius, 0, 0]}
            {...(style.barSize ? { barSize: style.barSize } : {})}
          >
            {style.barLabels && (
              <LabelList
                dataKey={k}
                position={horizontal ? "right" : "top"}
                formatter={(v: number) => fmt(v)}
                style={{ fill: theme.muted_text_color, fontSize: 10 }}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
