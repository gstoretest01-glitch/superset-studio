import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

import { formatNumber, inferSeries, type ReportTheme } from "@/lib/report-types";

type Props = {
  kind: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  theme: ReportTheme;
  compact?: boolean;
};

function pickKind(kind: string, numericCount: number, rowCount: number) {
  if (kind !== "auto") return kind;
  if (rowCount === 1 && numericCount === 1) return "kpi";
  if (numericCount === 0) return "table";
  if (rowCount > 24) return "line";
  return "bar";
}

export function ChartRenderer({ kind, columns, rows, theme, compact }: Props) {
  const { xKey, numericKeys } = inferSeries(columns, rows);
  const resolved = pickKind(kind, numericKeys.length, rows.length);
  const palette = theme.palette.length > 0 ? theme.palette : ["#2dd4bf"];

  const axisStyle = { fill: theme.muted_text_color, fontSize: compact ? 10 : 11 };
  const tooltipStyle = {
    background: theme.surface_color,
    border: `1px solid ${theme.border_color}`,
    borderRadius: 10,
    color: theme.text_color,
    fontSize: 12,
  };

  if (rows.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center text-xs"
        style={{ color: theme.muted_text_color }}
      >
        Không có dữ liệu
      </div>
    );
  }

  if (resolved === "kpi") {
    const metric = numericKeys[0] ?? columns[0]!;
    const value = Number(rows[0]?.[metric] ?? 0);
    return (
      <div className="flex h-full flex-col items-start justify-center gap-1">
        <span
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ color: theme.muted_text_color }}
        >
          {metric}
        </span>
        <span
          className="text-4xl font-semibold tabular-nums sm:text-5xl"
          style={{ color: theme.accent_color, fontFamily: theme.font_family }}
        >
          {formatNumber(value)}
        </span>
      </div>
    );
  }

  if (resolved === "table") {
    return (
      <div className="scroll-thin h-full overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className="sticky top-0 whitespace-nowrap px-2 py-1.5 text-left font-medium"
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
              <tr key={i}>
                {columns.map((c) => (
                  <td
                    key={c}
                    className="whitespace-nowrap px-2 py-1.5 tabular-nums"
                    style={{
                      color: theme.text_color,
                      borderBottom: `1px solid ${theme.border_color}`,
                    }}
                  >
                    {typeof row[c] === "number"
                      ? formatNumber(row[c] as number)
                      : String(row[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (resolved === "pie") {
    const metric = numericKeys[0] ?? columns[1] ?? columns[0]!;
    const data = rows.slice(0, 12).map((r) => ({
      name: String(r[xKey] ?? ""),
      value: Number(r[metric] ?? 0),
    }));
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="78%" paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} stroke={theme.surface_color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatNumber(v)} />
          {!compact && <Legend wrapperStyle={{ fontSize: 11, color: theme.muted_text_color }} />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const commonAxes = (
    <>
      <CartesianGrid stroke={theme.border_color} strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={{ stroke: theme.border_color }} minTickGap={12} />
      <YAxis
        tick={axisStyle}
        tickLine={false}
        axisLine={false}
        width={compact ? 34 : 48}
        tickFormatter={(v: number) => formatNumber(v)}
      />
      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatNumber(v)} cursor={{ fill: `${theme.border_color}55` }} />
      {numericKeys.length > 1 && !compact && (
        <Legend wrapperStyle={{ fontSize: 11, color: theme.muted_text_color }} />
      )}
    </>
  );

  if (resolved === "line" || resolved === "area") {
    const Chart = resolved === "line" ? LineChart : AreaChart;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {commonAxes}
          {numericKeys.map((k, i) =>
            resolved === "line" ? (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={palette[i % palette.length]}
                strokeWidth={2}
                dot={false}
              />
            ) : (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                stroke={palette[i % palette.length]}
                fill={palette[i % palette.length]}
                fillOpacity={0.22}
                strokeWidth={2}
              />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        {commonAxes}
        {numericKeys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={palette[i % palette.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
