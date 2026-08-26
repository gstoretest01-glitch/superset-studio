import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import type { Layout, LayoutItem } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";

import { BlockCard, VIEWPORT_WIDTH, type BlockFetcher, type Viewport } from "./BlockCards";
import { ContainerBlock } from "./ContainerBlock";
import { isContainerBlock, resolveReportLayout, type BlockLayout, type GridPos, type ReportBlock, type ReportTheme } from "@/lib/report-types";

const ResponsiveGrid = WidthProvider(Responsive);

const ROW_HEIGHT = 20;

function toLayoutItem(id: string, pos: GridPos): LayoutItem {
  return { i: id, x: pos.x, y: pos.y, w: Math.max(1, Math.min(12, pos.w)), h: Math.max(1, pos.h) };
}

/** Canvas có thể kéo-thả/resize tự do (dùng trong Report Builder). */
export function GridCanvas({
  blocks,
  theme,
  fetcher,
  viewport,
  selectedId,
  onSelect,
  maxWidth,
  canEdit,
  onLayoutCommit,
}: {
  blocks: ReportBlock[];
  theme: ReportTheme;
  fetcher: BlockFetcher;
  viewport: Viewport;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  maxWidth?: number;
  canEdit: boolean;
  onLayoutCommit: (next: Array<{ id: string; layout: BlockLayout }>) => void;
}) {
  // Lưới ngoài chỉ định vị block cấp gốc — block con của Tabs/Row/Column được chính container
  // tự bố cục bên trong (xem ContainerBlock), không có layout x/y riêng.
  const rootBlocks = blocks.filter((b) => b.parent_block_id == null);
  const layouts = resolveReportLayout(rootBlocks);
  const rglLayout: Layout = rootBlocks.map((b) => toLayoutItem(b.id, layouts.get(b.id)![viewport]!));

  const commit = (current: Layout) => {
    const next = current
      .map((item) => {
        const block = rootBlocks.find((b) => b.id === item.i);
        if (!block) return null;
        const prevPos = layouts.get(block.id)![viewport]!;
        const nextPos: GridPos = { x: item.x, y: item.y, w: item.w, h: item.h };
        if (prevPos.x === nextPos.x && prevPos.y === nextPos.y && prevPos.w === nextPos.w && prevPos.h === nextPos.h) {
          return null;
        }
        const prevLayout = layouts.get(block.id)!;
        return { id: block.id, layout: { ...prevLayout, [viewport]: nextPos } };
      })
      .filter((v): v is { id: string; layout: BlockLayout } => v !== null);
    if (next.length > 0) onLayoutCommit(next);
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
      <div className="p-3 sm:p-5" style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined, marginInline: "auto" }}>
        {rootBlocks.length === 0 ? (
          <div
            className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm"
            style={{ borderColor: theme.border_color, color: theme.muted_text_color }}
          >
            Báo cáo chưa có khối nào
          </div>
        ) : (
          <ResponsiveGrid
            key={viewport}
            className="rs-rgl"
            breakpoints={{ [viewport]: 0 }}
            cols={{ [viewport]: 12 }}
            layouts={{ [viewport]: rglLayout }}
            rowHeight={ROW_HEIGHT}
            margin={[theme.gap_px, theme.gap_px]}
            containerPadding={[0, 0]}
            compactType={null}
            preventCollision={false}
            isDraggable={canEdit}
            isResizable={canEdit}
            draggableCancel=".rs-no-drag"
            onDragStop={(current) => commit(current)}
            onResizeStop={(current) => commit(current)}
          >
            {rootBlocks.map((block) => {
              if (viewport === "sm" && block.hide_on_mobile) {
                return (
                  <div key={block.id} style={{ display: "none" }}>
                    <div />
                  </div>
                );
              }
              return (
                <div
                  key={block.id}
                  data-hide-mobile={block.hide_on_mobile}
                  onClick={onSelect ? () => onSelect(block.id) : undefined}
                >
                  <div
                    className="h-full rounded-[inherit]"
                    style={
                      selectedId === block.id
                        ? {
                            outline: `2px solid ${theme.accent_color}`,
                            outlineOffset: 2,
                            borderRadius: block.radius_px ?? theme.radius_px,
                          }
                        : undefined
                    }
                  >
                    {isContainerBlock(block) ? (
                      <ContainerBlock
                        block={block}
                        allBlocks={blocks}
                        theme={theme}
                        fetcher={fetcher}
                        {...(selectedId !== undefined ? { selectedId } : {})}
                        {...(onSelect ? { onSelect } : {})}
                      />
                    ) : (
                      <BlockCard block={block} theme={theme} fetcher={fetcher} enabled={true} />
                    )}
                  </div>
                </div>
              );
            })}
          </ResponsiveGrid>
        )}
      </div>
    </div>
  );
}
