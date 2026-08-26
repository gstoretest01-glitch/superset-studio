import { resolveContainerConfig, type ReportBlock } from "./report-types";

/**
 * Cây layout trong bộ nhớ, dẫn xuất từ mảng report_blocks (KHÔNG lưu DB — luôn tính lại từ
 * rows). Mô phỏng mô hình "flat map id -> node" của Apache Superset (dashboard/types.ts):
 * quan hệ cha-con chỉ qua id (parent_block_id/children), không phải object lồng nhau thật.
 */
export type TreeNode = {
  id: string;
  type: string;
  parentId: string | null;
  slot: string | null;
  position: number;
  /** Con theo từng slot, đã sort theo position. Key "" cho block cấp gốc (không có slot). */
  childrenBySlot: Record<string, string[]>;
};

export type BlockTree = {
  nodes: Record<string, TreeNode>;
  /** id các block cấp gốc (parent_block_id == null), đã sort theo position. */
  roots: string[];
};

export function buildTree(blocks: ReportBlock[]): BlockTree {
  const nodes: Record<string, TreeNode> = {};
  for (const b of blocks) {
    nodes[b.id] = {
      id: b.id,
      type: b.block_type,
      parentId: b.parent_block_id,
      slot: b.parent_slot,
      position: b.position,
      childrenBySlot: {},
    };
  }
  const sorted = [...blocks].sort((a, b) => a.position - b.position);
  const roots: string[] = [];
  for (const b of sorted) {
    if (b.parent_block_id == null) {
      roots.push(b.id);
      continue;
    }
    const parent = nodes[b.parent_block_id];
    if (!parent) continue; // cha đã bị xoá / dữ liệu mồ côi — bỏ qua an toàn
    const slotKey = b.parent_slot ?? "";
    (parent.childrenBySlot[slotKey] ??= []).push(b.id);
  }
  return { nodes, roots };
}

/** Toàn bộ tổ tiên của `id` (gần nhất trước), dùng để chặn thả 1 khối vào chính con cháu của nó. */
export function ancestorsOf(tree: BlockTree, id: string): string[] {
  const out: string[] = [];
  let cur = tree.nodes[id]?.parentId ?? null;
  let guard = 0;
  while (cur && guard++ < 64) {
    out.push(cur);
    cur = tree.nodes[cur]?.parentId ?? null;
  }
  return out;
}

/** Danh sách slot hợp lệ của 1 container (tab id / cột index), đọc từ container_config. */
export function slotsOf(block: ReportBlock): Array<{ id: string; label: string }> {
  const config = resolveContainerConfig(block);
  if ("tabs" in config) return config.tabs.map((t) => ({ id: t.id, label: t.label }));
  return config.sizes.map((_, i) => ({ id: String(i), label: `Ô ${i + 1}` }));
}

/** Danh sách id block con của 1 slot cụ thể, đã sort theo position. */
export function childrenInSlot(tree: BlockTree, containerId: string, slot: string): string[] {
  return tree.nodes[containerId]?.childrenBySlot[slot] ?? [];
}
