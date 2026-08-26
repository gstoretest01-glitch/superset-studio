import { GridCanvas } from "./GridCanvas";
import { StaticCanvas } from "./StaticCanvas";
import type { BlockFetcher, Viewport } from "./BlockCards";
import type { BlockLayout, ReportBlock, ReportTheme } from "@/lib/report-types";

export type { BlockData, BlockFetcher, Viewport } from "./BlockCards";

/**
 * Canvas của báo cáo: kéo-thả tự do khi `editable` (Report Builder), hoặc render tĩnh
 * theo layout đã lưu (trang xem công khai).
 */
export function ReportCanvas({
  blocks,
  theme,
  fetcher,
  viewport = "lg",
  selectedId,
  onSelect,
  maxWidth,
  editable = false,
  canEdit = false,
  onLayoutCommit,
}: {
  blocks: ReportBlock[];
  theme: ReportTheme;
  fetcher: BlockFetcher;
  viewport?: Viewport;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  maxWidth?: number;
  editable?: boolean;
  canEdit?: boolean;
  onLayoutCommit?: (next: Array<{ id: string; layout: BlockLayout }>) => void;
}) {
  if (editable) {
    return (
      <GridCanvas
        blocks={blocks}
        theme={theme}
        fetcher={fetcher}
        viewport={viewport}
        canEdit={canEdit}
        onLayoutCommit={onLayoutCommit ?? (() => {})}
        {...(selectedId !== undefined ? { selectedId } : {})}
        {...(onSelect ? { onSelect } : {})}
        {...(maxWidth !== undefined ? { maxWidth } : {})}
      />
    );
  }
  return (
    <StaticCanvas
      blocks={blocks}
      theme={theme}
      fetcher={fetcher}
      {...(maxWidth !== undefined ? { maxWidth } : {})}
    />
  );
}
