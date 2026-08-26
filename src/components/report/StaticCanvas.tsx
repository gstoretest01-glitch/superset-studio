import { useEffect, useState } from "react";

import { BlockCard, VIEWPORT_WIDTH, type BlockFetcher, type Viewport } from "./BlockCards";
import { resolveReportLayout, type ReportBlock, type ReportTheme } from "@/lib/report-types";

const ROW_HEIGHT = 20;
const BREAKPOINT_QUERIES: Record<Exclude<Viewport, "lg">, string> = {
  sm: "(max-width: 767px)",
  md: "(max-width: 1179px)",
};

/** Suy ra breakpoint hiện tại của trình duyệt (mặc định "lg" khi SSR/chưa hydrate). */
function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>("lg");
  useEffect(() => {
    const compute = () => {
      if (window.matchMedia(BREAKPOINT_QUERIES.sm).matches) return "sm" as const;
      if (window.matchMedia(BREAKPOINT_QUERIES.md).matches) return "md" as const;
      return "lg" as const;
    };
    setViewport(compute());
    const mqSm = window.matchMedia(BREAKPOINT_QUERIES.sm);
    const mqMd = window.matchMedia(BREAKPOINT_QUERIES.md);
    const onChange = () => setViewport(compute());
    mqSm.addEventListener("change", onChange);
    mqMd.addEventListener("change", onChange);
    return () => {
      mqSm.removeEventListener("change", onChange);
      mqMd.removeEventListener("change", onChange);
    };
  }, []);
  return viewport;
}

/** Canvas tĩnh (không kéo-thả) dùng ở trang xem công khai — render đúng layout đã lưu. */
export function StaticCanvas({
  blocks,
  theme,
  fetcher,
  maxWidth,
}: {
  blocks: ReportBlock[];
  theme: ReportTheme;
  fetcher: BlockFetcher;
  maxWidth?: number;
}) {
  const viewport = useViewport();
  const layouts = resolveReportLayout(blocks);
  const visibleBlocks = blocks.filter((b) => !(viewport === "sm" && b.hide_on_mobile));

  let maxY = 0;
  const positions = visibleBlocks.map((block) => {
    const pos = layouts.get(block.id)![viewport]!;
    maxY = Math.max(maxY, pos.y + pos.h);
    return { block, pos };
  });
  const containerHeight = maxY * ROW_HEIGHT + Math.max(0, maxY - 1) * theme.gap_px;

  return (
    <div
      className="w-full"
      style={{
        width: VIEWPORT_WIDTH[viewport],
        maxWidth: "100%",
        marginInline: "auto",
        background: theme.page_color,
        borderRadius: viewport === "lg" ? 0 : 16,
      }}
    >
      <div className="p-3 sm:p-5" style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined, marginInline: "auto" }}>
        {visibleBlocks.length === 0 ? (
          <div
            className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm"
            style={{ borderColor: theme.border_color, color: theme.muted_text_color }}
          >
            Báo cáo chưa có khối nào
          </div>
        ) : (
          <div className="relative w-full" style={{ height: containerHeight }}>
            {positions.map(({ block, pos }) => {
              const leftPct = (pos.x / 12) * 100;
              const widthPct = (pos.w / 12) * 100;
              const top = pos.y * (ROW_HEIGHT + theme.gap_px);
              const height = pos.h * ROW_HEIGHT + Math.max(0, pos.h - 1) * theme.gap_px;
              return (
                <div
                  key={block.id}
                  className="absolute"
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    top,
                    height,
                    padding: theme.gap_px / 2,
                    boxSizing: "border-box",
                  }}
                >
                  <BlockCard block={block} theme={theme} fetcher={fetcher} enabled={true} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
