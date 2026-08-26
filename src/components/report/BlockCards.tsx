import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Maximize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ChartRenderer } from "./ChartRenderer";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveStyle } from "@/lib/block-style";
import type { ChartRow, ReportBlock, ReportTheme } from "@/lib/report-types";

export type BlockData = {
  columns: string[];
  rows: ChartRow[];
  error: string | null;
};

export type BlockFetcher = (block: ReportBlock) => Promise<BlockData>;

export type Viewport = "lg" | "md" | "sm";

export const VIEWPORT_WIDTH: Record<Viewport, string> = {
  lg: "100%",
  md: "834px",
  sm: "390px",
};

/** Khối có nguồn dữ liệu vẽ bằng ChartRenderer — biểu đồ Superset có sẵn hoặc chart tạo trong app. */
export function isChartBlock(block: ReportBlock): boolean {
  return block.block_type === "superset_chart" || block.block_type === "adhoc_query";
}

/** Khối đã có nguồn dữ liệu gắn vào (đủ để fetch), phân biệt với khối vừa thêm còn trống. */
export function hasBlockSource(block: ReportBlock): boolean {
  return block.chart_id != null || block.dataset_id != null;
}

export function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);
  return { ref, visible };
}

export function BlockShell({
  block,
  theme,
  children,
  onFullscreen,
}: {
  block: ReportBlock;
  theme: ReportTheme;
  children: React.ReactNode;
  onFullscreen?: () => void;
}) {
  const style = resolveStyle(block.style_config);
  return (
    <div
      className="group/block relative flex h-full flex-col overflow-hidden"
      style={{
        background: block.background_color ?? theme.surface_color,
        border: `1px solid ${block.border_color ?? theme.border_color}`,
        borderRadius: block.radius_px ?? theme.radius_px,
        padding: block.padding_px,
        color: theme.text_color,
      }}
    >
      {block.show_title && (block.title || block.chart_name) && (
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1" style={{ textAlign: style.titleAlign }}>
            <h3
              className="truncate font-semibold"
              style={{
                fontFamily: theme.font_family,
                color: style.titleColor ?? theme.text_color,
                fontSize: `${style.titleSize}px`,
              }}
            >
              {block.title || block.chart_name}
            </h3>
            {style.subtitle && isChartBlock(block) && (
              <p className="truncate text-[11px]" style={{ color: theme.muted_text_color }}>
                {style.subtitle}
              </p>
            )}
          </div>
          {onFullscreen && (
            <button
              type="button"
              onClick={onFullscreen}
              aria-label="Xem toàn màn hình"
              className="rs-no-drag rounded-md p-1 opacity-0 transition-opacity group-hover/block:opacity-100 focus:opacity-100"
              style={{ color: theme.muted_text_color }}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export function ChartBlockCard({
  block,
  theme,
  fetcher,
  enabled,
}: {
  block: ReportBlock;
  theme: ReportTheme;
  fetcher: BlockFetcher;
  enabled: boolean;
}) {
  const { ref, visible } = useInView<HTMLDivElement>();
  const [full, setFull] = useState(false);
  const hasSource = hasBlockSource(block);

  const query = useQuery({
    queryKey: [
      "block-data",
      block.id,
      block.chart_id,
      block.dataset_id,
      block.row_limit,
      JSON.stringify(block.adhoc_metrics),
      JSON.stringify(block.adhoc_groupby),
    ],
    queryFn: () => fetcher(block),
    enabled: enabled && visible && hasSource,
    staleTime: 60_000,
  });

  const content = (compact: boolean) => {
    if (!hasSource) {
      return (
        <div className="flex h-full items-center justify-center text-xs" style={{ color: theme.muted_text_color }}>
          Chưa chọn nguồn dữ liệu
        </div>
      );
    }
    if (query.isPending || !visible) {
      return <Skeleton className="h-full w-full" style={{ background: `${theme.border_color}66` }} />;
    }
    if (query.isError || query.data?.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1.5 px-3 text-center">
          <AlertTriangle className="h-4 w-4" style={{ color: theme.accent_color }} />
          <span className="text-xs" style={{ color: theme.muted_text_color }}>
            {query.data?.error ?? "Không tải được dữ liệu"}
          </span>
        </div>
      );
    }
    return (
      <ChartRenderer
        kind={block.chart_kind}
        columns={query.data!.columns}
        rows={query.data!.rows}
        theme={theme}
        style={block.style_config}
        compact={compact}
      />
    );
  };

  return (
    <div ref={ref} className="h-full">
      <BlockShell block={block} theme={theme} onFullscreen={() => setFull(true)}>
        {content(true)}
      </BlockShell>
      {full && (
        <div
          className="fixed inset-0 z-50 flex flex-col p-4"
          style={{ background: theme.page_color }}
          onClick={() => setFull(false)}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold" style={{ color: theme.text_color }}>
              {block.title || block.chart_name}
            </h3>
            <button
              type="button"
              className="rounded-md px-3 py-1 text-sm"
              style={{ color: theme.muted_text_color, border: `1px solid ${theme.border_color}` }}
            >
              Đóng
            </button>
          </div>
          <div className="min-h-0 flex-1" onClick={(e) => e.stopPropagation()}>
            {content(false)}
          </div>
        </div>
      )}
    </div>
  );
}

export function TextBlockCard({ block, theme }: { block: ReportBlock; theme: ReportTheme }) {
  return (
    <BlockShell block={block} theme={theme}>
      <div className="flex h-full flex-col justify-center gap-1">
        {block.block_type === "heading" ? (
          <h2
            className="text-xl font-semibold sm:text-2xl"
            style={{ fontFamily: theme.font_family, color: theme.text_color }}
          >
            {block.title}
          </h2>
        ) : null}
        {block.body && (
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: theme.muted_text_color }}>
            {block.body}
          </p>
        )}
      </div>
    </BlockShell>
  );
}

export function BlockCard({
  block,
  theme,
  fetcher,
  enabled,
}: {
  block: ReportBlock;
  theme: ReportTheme;
  fetcher: BlockFetcher;
  enabled: boolean;
}) {
  return isChartBlock(block) ? (
    <ChartBlockCard block={block} theme={theme} fetcher={fetcher} enabled={enabled} />
  ) : (
    <TextBlockCard block={block} theme={theme} />
  );
}
