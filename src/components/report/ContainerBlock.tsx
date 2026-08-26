import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlockCard, type BlockFetcher } from "./BlockCards";
import { slotsOf } from "@/lib/block-tree";
import type { ReportBlock, ReportTheme } from "@/lib/report-types";

type ContainerProps = {
  block: ReportBlock;
  allBlocks: ReportBlock[];
  theme: ReportTheme;
  fetcher: BlockFetcher;
  selectedId?: string | null | undefined;
  onSelect?: ((id: string) => void) | undefined;
};

function childrenOf(block: ReportBlock, allBlocks: ReportBlock[], slot: string): ReportBlock[] {
  return allBlocks
    .filter((b) => b.parent_block_id === block.id && b.parent_slot === slot)
    .sort((a, b) => a.position - b.position);
}

function ChildSlotEmpty({ theme }: { theme: ReportTheme }) {
  return (
    <div
      className="flex h-24 items-center justify-center rounded-lg border border-dashed text-xs"
      style={{ borderColor: theme.border_color, color: theme.muted_text_color }}
    >
      Trống — chọn khối này rồi thêm nội dung
    </div>
  );
}

function ChildBlockList({
  items,
  allBlocks,
  theme,
  fetcher,
  selectedId,
  onSelect,
}: {
  items: ReportBlock[];
  allBlocks: ReportBlock[];
  theme: ReportTheme;
  fetcher: BlockFetcher;
  selectedId?: string | null | undefined;
  onSelect?: ((id: string) => void) | undefined;
}) {
  if (items.length === 0) return <ChildSlotEmpty theme={theme} />;
  return (
    <div className="flex flex-col gap-3">
      {items.map((child) => (
        <div
          key={child.id}
          className="rounded-[inherit]"
          style={{ minHeight: 120, outline: selectedId === child.id ? `2px solid ${theme.accent_color}` : undefined, outlineOffset: 2 }}
          onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(child.id); } : undefined}
        >
          <div style={{ height: 220 }}>
            <ContainerAwareChild
              block={child}
              allBlocks={allBlocks}
              theme={theme}
              fetcher={fetcher}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Con của container có thể bản thân nó cũng là 1 container (Row trong Tabs, v.v). */
function ContainerAwareChild(props: ContainerProps) {
  if (props.block.block_type === "divider") {
    return <hr style={{ borderColor: props.theme.border_color }} />;
  }
  if (props.block.block_type === "tabs" || props.block.block_type === "row" || props.block.block_type === "column") {
    return <ContainerBlock {...props} />;
  }
  return <BlockCard block={props.block} theme={props.theme} fetcher={props.fetcher} enabled={true} />;
}

function TabsContainer({ block, allBlocks, theme, fetcher, selectedId, onSelect }: ContainerProps) {
  const tabs = slotsOf(block);
  return (
    <Tabs {...(tabs[0] ? { defaultValue: tabs[0].id } : {})} className="flex h-full flex-col">
      <TabsList className="rs-no-drag shrink-0">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="scroll-thin min-h-0 flex-1 overflow-auto pt-2">
        {tabs.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-0 h-full">
            <ChildBlockList
              items={childrenOf(block, allBlocks, t.id)}
              allBlocks={allBlocks}
              theme={theme}
              fetcher={fetcher}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}

function RowColumnContainer({ block, allBlocks, theme, fetcher, selectedId, onSelect }: ContainerProps) {
  const slots = slotsOf(block);
  const isRow = block.block_type === "row";
  return (
    <div className={`scroll-thin flex h-full gap-3 overflow-auto ${isRow ? "flex-row" : "flex-col"}`}>
      {slots.map((slot) => (
        <div key={slot.id} style={isRow ? { flexBasis: `${100 / slots.length}%`, flexShrink: 0 } : { flex: `0 0 auto` }}>
          <ChildBlockList
            items={childrenOf(block, allBlocks, slot.id)}
            allBlocks={allBlocks}
            theme={theme}
            fetcher={fetcher}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </div>
      ))}
    </div>
  );
}

/** Render 1 block "container" (tabs/row/column) và bố cục các block con của nó. */
export function ContainerBlock(props: ContainerProps) {
  if (props.block.block_type === "tabs") return <TabsContainer {...props} />;
  return <RowColumnContainer {...props} />;
}
