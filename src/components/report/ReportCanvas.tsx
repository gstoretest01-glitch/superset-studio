import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Maximize2 } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { ChartRenderer } from "./ChartRenderer";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChartRow, ReportBlock, ReportTheme } from "@/lib/report-types";

export type BlockData = {
  columns: string[];
  rows: ChartRow[];
  error: string | null;
};

export type BlockFetcher = (block: ReportBlock) => Promise<BlockData>;

export type Viewport = "lg" | "md" | "sm";

const VIEWPORT_WIDTH: Record<Viewport, string> = {
  lg: "100%",
  md: "834px",
  sm: "390px",
};

function useInView<T extends HTMLElement>() {
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

function BlockShell({
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
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3
            className="truncate text-sm font-semibold"
            style={{ fontFamily: theme.font_family, color: theme.text_color }}
          >
            {block.title || block.chart_name}
          </h3>
          {onFullscreen && (
            <button
              type="button"
              onClick={onFullscreen}
              aria-label="Xem toàn màn hình"
              className="rounded-md p-1 opacity-0 transition-opacity group-hover/block:opacity-100 focus:opacity-100"
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

function ChartBlockCard({
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

  const query = useQuery({
    queryKey: ["block-data", block.id, block.chart_id, block.row_limit],
    queryFn: () => fetcher(block),
    enabled: enabled && visible && block.chart_id != null,
    staleTime: 60_000,
  });

  const content = (compact: boolean) => {
    if (block.chart_id == null) {
      return (
        <div className="flex h-full items-center justify-center text-xs" style={{ color: theme.muted_text_color }}>
          Chưa chọn biểu đồ
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

function TextBlockCard({ block, theme }: { block: ReportBlock; theme: ReportTheme }) {
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

export function ReportCanvas({
  blocks,
  theme,
  fetcher,
  viewport = "lg",
  enabled = true,
  selectedId,
  onSelect,
  maxWidth,
}: {
  blocks: ReportBlock[];
  theme: ReportTheme;
  fetcher: BlockFetcher;
  viewport?: Viewport;
  enabled?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  maxWidth?: number;
}) {
  const gridStyle: CSSProperties = {
    ["--rs-gap" as string]: `${theme.gap_px}px`,
    maxWidth: maxWidth ? `${maxWidth}px` : undefined,
    marginInline: "auto",
  };

  return (
    <div
      className="w-full transition-[width] duration-300"
      style={{
        width: VIEWPORT_WIDTH[viewport],
        maxWidth: "100%",
        marginInline: "auto",
        background: theme.page_color,
        borderRadius: viewport === "lg" ? 0 : 16,
      }}
    >
      <div className="rs-grid p-3 sm:p-5" style={gridStyle}>
        {blocks.map((block) => {
          const spanLg = viewport === "lg" ? block.span_lg : viewport === "md" ? block.span_md : block.span_sm;
          const style: CSSProperties = {
            ["--span-lg" as string]: spanLg,
            ["--span-md" as string]: viewport === "sm" ? block.span_sm : block.span_md,
            ["--span-sm" as string]: block.span_sm,
            ["--rs-h" as string]: `${viewport === "sm" ? block.height_sm_px : block.height_px}px`,
            ["--rs-h-sm" as string]: `${block.height_sm_px}px`,
          };
          if (viewport !== "lg") {
            style.gridColumn = `span ${spanLg} / span ${spanLg}`;
            style.height = `${viewport === "sm" ? block.height_sm_px : block.height_px}px`;
          }
          if (viewport === "sm" && block.hide_on_mobile) return null;

          return (
            <div
              key={block.id}
              className="rs-block"
              data-hide-mobile={block.hide_on_mobile}
              style={style}
              onClick={onSelect ? () => onSelect(block.id) : undefined}
            >
              <div
                className="h-full rounded-[inherit]"
                style={
                  selectedId === block.id
                    ? { outline: `2px solid ${theme.accent_color}`, outlineOffset: 2, borderRadius: block.radius_px ?? theme.radius_px }
                    : undefined
                }
              >
                {block.block_type === "superset_chart" ? (
                  <ChartBlockCard block={block} theme={theme} fetcher={fetcher} enabled={enabled} />
                ) : (
                  <TextBlockCard block={block} theme={theme} />
                )}
              </div>
            </div>
          );
        })}
        {blocks.length === 0 && (
          <div
            className="col-span-12 flex h-48 items-center justify-center rounded-xl border border-dashed text-sm"
            style={{ borderColor: theme.border_color, color: theme.muted_text_color }}
          >
            Báo cáo chưa có khối nào
          </div>
        )}
      </div>
    </div>
  );
}
