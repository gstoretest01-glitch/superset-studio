import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Columns2,
  ExternalLink,
  Minus,
  Monitor,
  Plus,
  Rows,
  Smartphone,
  Tablet,
  Trash2,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, useMyRole } from "@/components/app-shell";
import { ReportCanvas, type Viewport } from "@/components/report/ReportCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { StyleInspector } from "@/components/report/StyleInspector";
import { AdhocChartBuilder, AdhocChartEditor, type AdhocChartResult } from "@/components/report/AdhocChartBuilder";
import { resolveStyle, type BlockStyle } from "@/lib/block-style";
import {
  CHART_KINDS,
  FALLBACK_THEME,
  isContainerBlock,
  planNewBlockLayout,
  resolveContainerConfig,
  resolveReportLayout,
  type BlockLayout,
  type Report,
  type ReportBlock,
  type ReportTheme,
} from "@/lib/report-types";
import { isChartBlock } from "@/components/report/BlockCards";
import { getAdhocChartData, getChartData, listCharts } from "@/lib/superset.functions";

export const Route = createFileRoute("/_authenticated/reports/$id")({
  head: () => ({
    meta: [
      { title: "Trình dựng báo cáo — Report Studio" },
      { name: "description", content: "Kéo thả biểu đồ Superset, chỉnh màu sắc và kích thước cho từng khổ màn hình." },
      { property: "og:title", content: "Trình dựng báo cáo — Report Studio" },
      { property: "og:description", content: "Kéo thả biểu đồ Superset và tuỳ chỉnh bố cục responsive." },
    ],
  }),
  component: BuilderPage,
});

const VIEWPORTS: Array<{ key: Viewport; label: string; icon: typeof Monitor }> = [
  { key: "lg", label: "Máy tính", icon: Monitor },
  { key: "md", label: "Máy tính bảng", icon: Tablet },
  { key: "sm", label: "Điện thoại", icon: Smartphone },
];

// Module-level (không phải useRef/useState) để chặn backfill chạy trùng lặp cho cùng report_id
// kể cả khi component unmount/remount liên tiếp (React StrictMode ở dev) — useRef bị reset mỗi
// lần mount lại nên không đủ để ngăn 2 lần backfill race nhau ghi đè layout khác nhau.
const backfilledReports = new Set<string>();

function BuilderPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: me } = useMyRole();
  const canEdit = me?.role === "admin" || me?.role === "editor";
  const [viewport, setViewport] = useState<Viewport>("lg");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chartSearch, setChartSearch] = useState("");

  const fetchChartData = useServerFn(getChartData);
  const fetchCharts = useServerFn(listCharts);
  const fetchAdhocData = useServerFn(getAdhocChartData);

  const report = useQuery({
    queryKey: ["report", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Report;
    },
  });

  const blocks = useQuery({
    queryKey: ["blocks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_blocks")
        .select("*")
        .eq("report_id", id)
        .order("position");
      if (error) throw error;
      // types.ts chưa có cột container_config/parent_block_id/parent_slot — Lovable Cloud sẽ
      // tự regenerate sau khi migration 20260826120000 được áp dụng. Cast tạm qua unknown.
      return data as unknown as ReportBlock[];
    },
  });

  const themes = useQuery({
    queryKey: ["themes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("report_themes").select("*").order("created_at");
      if (error) throw error;
      return data as ReportTheme[];
    },
  });

  const connections = useQuery({
    queryKey: ["connections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("superset_connections").select("id, name").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const charts = useQuery({
    queryKey: ["superset-charts", report.data?.connection_id, chartSearch],
    queryFn: () => fetchCharts({ data: { connectionId: report.data!.connection_id!, search: chartSearch } }),
    enabled: Boolean(report.data?.connection_id),
    staleTime: 60_000,
  });

  const theme = useMemo(
    () => themes.data?.find((t) => t.id === report.data?.theme_id) ?? themes.data?.[0] ?? FALLBACK_THEME,
    [themes.data, report.data?.theme_id],
  );

  const selected = blocks.data?.find((b) => b.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !blocks.data?.some((b) => b.id === selectedId)) setSelectedId(null);
  }, [blocks.data, selectedId]);

  const updateReport = useMutation({
    mutationFn: async (patch: Partial<Report>) => {
      const { error } = await supabase.from("reports").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addBlock = useMutation({
    mutationFn: async (patch: Partial<ReportBlock>) => {
      const existing = blocks.data ?? [];
      // Block con của container (Tabs/Row/Column) không có layout x/y riêng — cha tự bố cục.
      const isChild = patch.parent_block_id != null;
      const siblingsForPosition = isChild
        ? existing.filter((b) => b.parent_block_id === patch.parent_block_id && b.parent_slot === patch.parent_slot)
        : existing.filter((b) => b.parent_block_id == null);
      const position = siblingsForPosition.length + 1;
      const insertPatch: Partial<ReportBlock> = { report_id: id, position, ...patch };
      if (!isChild) {
        const rootBlocks = existing.filter((b) => b.parent_block_id == null);
        const othersLayout = [...resolveReportLayout(rootBlocks).values()];
        insertPatch.layout = planNewBlockLayout(patch.block_type ?? "superset_chart", othersLayout) as unknown as ReportBlock["layout"];
      }
      // types.ts chưa có cột container_config/parent_block_id/parent_slot — cast tạm qua unknown
      // cho đến khi Lovable Cloud regenerate sau khi migration được áp dụng.
      const { data, error } = await supabase
        .from("report_blocks")
        .insert(insertPatch as unknown as never)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (newId) => {
      setSelectedId(newId);
      qc.invalidateQueries({ queryKey: ["blocks", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateBlock = useMutation({
    mutationFn: async ({ blockId, patch }: { blockId: string; patch: Partial<ReportBlock> }) => {
      const { error } = await supabase
        .from("report_blocks")
        .update(patch as unknown as never)
        .eq("id", blockId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocks", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeBlock = useMutation({
    mutationFn: async (blockId: string) => {
      const { error } = await supabase.from("report_blocks").delete().eq("id", blockId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocks", id] }),
  });

  const updateBlockLayout = useMutation({
    mutationFn: async (changes: Array<{ id: string; layout: BlockLayout }>) => {
      await Promise.all(
        changes.map(({ id: blockId, layout }) =>
          supabase
            .from("report_blocks")
            .update({ layout: layout as unknown as ReportBlock["layout"] })
            .eq("id", blockId),
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocks", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const onLayoutCommit = (changes: Array<{ id: string; layout: BlockLayout }>) => {
    qc.setQueryData(["blocks", id], (old: ReportBlock[] | undefined) =>
      old?.map((b) => {
        const change = changes.find((c) => c.id === b.id);
        return change ? { ...b, layout: change.layout as unknown as ReportBlock["layout"] } : b;
      }),
    );
    updateBlockLayout.mutate(changes);
  };

  // Backfill 1 lần cho block cũ chưa có layout đầy đủ (dữ liệu tạo trước khi có auto-placement):
  // resolveReportLayout tính vị trí ổn định, ta lưu lại tường minh để không phải suy luận lại
  // mỗi lần render (tránh chồng lấn khi thứ tự block thay đổi giữa các lần tính).
  useEffect(() => {
    if (backfilledReports.has(id) || !blocks.data || blocks.data.length === 0) return;
    // Đánh dấu NGAY trước khi tính toán (đồng bộ, không có await ở giữa) để lần chạy thứ 2
    // (StrictMode remount, hoặc effect re-fire khi blocks.data đổi identity trong lúc mutation
    // đầu chưa kịp lưu) luôn thấy report này đã được xử lý — tránh 2 lần tính song song trên
    // cùng dữ liệu cũ rồi ghi đè nhau ra kết quả trùng vị trí.
    backfilledReports.add(id);
    const missing = blocks.data.filter((b) => {
      const raw = b.layout && typeof b.layout === "object" ? (b.layout as Record<string, unknown>) : {};
      return (["lg", "md", "sm"] as const).some((bp) => raw[bp] == null);
    });
    if (missing.length === 0) return;
    const layouts = resolveReportLayout(blocks.data);
    const changes = missing.map((b) => ({ id: b.id, layout: layouts.get(b.id)! }));
    updateBlockLayout.mutate(changes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks.data]);

  const fetcher = useMemo(
    () => async (block: ReportBlock) => {
      const connectionId = report.data?.connection_id;
      if (!connectionId) {
        return { columns: [], rows: [], error: "Báo cáo chưa gắn kết nối Superset." };
      }
      if (block.block_type === "adhoc_query") {
        if (block.dataset_id == null) return { columns: [], rows: [], error: "Chưa chọn tập dữ liệu." };
        return fetchAdhocData({
          data: {
            connectionId,
            datasetId: block.dataset_id,
            groupby: Array.isArray(block.adhoc_groupby) ? (block.adhoc_groupby as string[]) : [],
            metrics: Array.isArray(block.adhoc_metrics) ? (block.adhoc_metrics as never[]) : [],
            rowLimit: block.row_limit,
            orderDesc: block.adhoc_order_desc,
          },
        });
      }
      if (block.chart_id == null) return { columns: [], rows: [], error: "Chưa chọn biểu đồ." };
      return fetchChartData({
        data: { connectionId, chartId: block.chart_id, rowLimit: block.row_limit },
      });
    },
    [fetchChartData, fetchAdhocData, report.data?.connection_id],
  );

  const selectedStyle = resolveStyle(selected?.style_config);
  const selectedLayout = selected ? (resolveReportLayout(blocks.data ?? []).get(selected.id) ?? null) : null;

  const selectedColumns = useQuery({
    queryKey: [
      "block-columns",
      selected?.id,
      selected?.chart_id,
      selected?.dataset_id,
      report.data?.connection_id,
    ],
    enabled: Boolean(selected && (selected.chart_id != null || selected.dataset_id != null) && report.data?.connection_id),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetcher({ ...selected!, row_limit: 10 });
      return res.columns ?? [];
    },
  });

  const applyStyle = (blockId: string, current: BlockStyle, patch: Partial<BlockStyle>) => {
    const next = { ...current, ...patch };
    qc.setQueryData(["blocks", id], (old: ReportBlock[] | undefined) =>
      old?.map((b) => (b.id === blockId ? { ...b, style_config: next } : b)),
    );
    updateBlock.mutate({ blockId, patch: { style_config: next } as Partial<ReportBlock> });
  };


  if (report.isPending) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Đang tải báo cáo…</p>
      </AppShell>
    );
  }

  const r = report.data!;

  return (
    <AppShell
      actions={
        <>
          <div className="hidden items-center rounded-lg border border-border p-0.5 md:flex">
            {VIEWPORTS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-label={label}
                onClick={() => setViewport(key)}
                className={`rounded-md px-2.5 py-1.5 transition-colors ${
                  viewport === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <Button size="sm" variant="secondary" asChild>
            <a href={`/r/${r.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-3.5 w-3.5" /> Xem
            </a>
          </Button>
          {canEdit && (
            <Button
              size="sm"
              variant={r.is_published ? "default" : "outline"}
              onClick={() => updateReport.mutate({ is_published: !r.is_published })}
            >
              {r.is_published ? "Đã xuất bản" : "Xuất bản"}
            </Button>
          )}
        </>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <Button size="icon" variant="ghost" asChild aria-label="Quay lại">
          <Link to="/reports">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Input
          className="max-w-sm font-display text-base font-semibold"
          value={r.title}
          onChange={(e) => qc.setQueryData(["report", id], { ...r, title: e.target.value })}
          onBlur={(e) => updateReport.mutate({ title: e.target.value })}
          disabled={!canEdit}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_1fr_300px]">
        {/* Panel trái: nguồn dữ liệu */}
        <aside className="space-y-4">
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="font-display text-sm font-semibold">Thiết lập</h2>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kết nối Superset</Label>
              <Select
                value={r.connection_id ?? ""}
                onValueChange={(v) => updateReport.mutate({ connection_id: v })}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue placeholder="Chọn kết nối" /></SelectTrigger>
                <SelectContent>
                  {connections.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Chủ đề</Label>
              <Select value={r.theme_id ?? ""} onValueChange={(v) => updateReport.mutate({ theme_id: v })} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="Chọn chủ đề" /></SelectTrigger>
                <SelectContent>
                  {themes.data?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bề rộng tối đa: {r.max_width_px}px</Label>
              <Slider
                value={[r.max_width_px]}
                min={960}
                max={1920}
                step={20}
                disabled={!canEdit}
                onValueChange={([v]) => qc.setQueryData(["report", id], { ...r, max_width_px: v })}
                onValueCommit={([v]) => updateReport.mutate({ max_width_px: v ?? r.max_width_px })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mô tả</Label>
              <Textarea
                value={r.description ?? ""}
                disabled={!canEdit}
                onChange={(e) => qc.setQueryData(["report", id], { ...r, description: e.target.value })}
                onBlur={(e) => updateReport.mutate({ description: e.target.value })}
              />
            </div>
          </div>

          {canEdit && (
            <div className="space-y-3 rounded-xl border border-border bg-card p-4">
              <h2 className="font-display text-sm font-semibold">Thêm khối</h2>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => addBlock.mutate({ block_type: "heading", title: "Tiêu đề mục", span_lg: 12, span_md: 12, height_px: 90, height_sm_px: 80 })}
              >
                <Type className="mr-1 h-3.5 w-3.5" /> Khối văn bản
              </Button>

              <div className="space-y-2">
                <Input
                  placeholder="Tìm biểu đồ Superset…"
                  value={chartSearch}
                  onChange={(e) => setChartSearch(e.target.value)}
                />
                <div className="scroll-thin max-h-72 space-y-1 overflow-auto">
                  {!r.connection_id && <p className="text-xs text-muted-foreground">Hãy chọn kết nối trước.</p>}
                  {charts.data?.error && <p className="text-xs text-destructive">{charts.data.error}</p>}
                  {charts.data?.charts?.map((c: { id: number; name: string; viz_type?: string }) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md border border-border px-2.5 py-2 text-left text-xs transition-colors hover:border-primary/60 hover:bg-secondary"
                      onClick={() =>
                        addBlock.mutate({
                          block_type: "superset_chart",
                          chart_id: c.id,
                          chart_name: c.name,
                          title: c.name,
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground">{c.viz_type}</span>
                    </button>
                  ))}
                </div>
              </div>

              <AdhocChartBuilder
                connectionId={r.connection_id}
                onCreate={(result: AdhocChartResult) =>
                  addBlock.mutate({
                    block_type: "adhoc_query",
                    dataset_id: result.datasetId,
                    dataset_name: result.datasetName,
                    adhoc_groupby: result.groupby,
                    adhoc_metrics: result.metrics,
                    row_limit: result.rowLimit,
                    adhoc_order_desc: result.orderDesc,
                    title: result.title,
                  })
                }
              />

              <div className="space-y-1.5 border-t border-border pt-3">
                <span className="text-xs font-medium text-muted-foreground">Bố cục</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                    onClick={() =>
                      addBlock.mutate({
                        block_type: "tabs",
                        title: "Các thẻ",
                        container_config: { tabs: [{ id: "tab-1", label: "Tab 1" }, { id: "tab-2", label: "Tab 2" }] } as unknown as ReportBlock["container_config"],
                      })
                    }
                  >
                    <Columns2 className="mr-1 h-3.5 w-3.5" /> Các thẻ
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                    onClick={() =>
                      addBlock.mutate({
                        block_type: "row",
                        title: "Hàng",
                        container_config: { sizes: [50, 50] } as unknown as ReportBlock["container_config"],
                      })
                    }
                  >
                    <Rows className="mr-1 h-3.5 w-3.5" /> Hàng
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                    onClick={() =>
                      addBlock.mutate({
                        block_type: "column",
                        title: "Cột",
                        container_config: { sizes: [50, 50] } as unknown as ReportBlock["container_config"],
                      })
                    }
                  >
                    <Columns2 className="mr-1 h-3.5 w-3.5 rotate-90" /> Cột
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                    onClick={() => addBlock.mutate({ block_type: "divider", title: null })}
                  >
                    <Minus className="mr-1 h-3.5 w-3.5" /> Đường kẻ
                  </Button>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Canvas */}
        <main className="min-w-0 rounded-xl border border-border p-2" style={{ background: theme.page_color }}>
          <ReportCanvas
            blocks={blocks.data ?? []}
            theme={theme}
            fetcher={fetcher}
            viewport={viewport}
            selectedId={selectedId}
            onSelect={setSelectedId}
            maxWidth={r.max_width_px}
            editable
            canEdit={canEdit}
            onLayoutCommit={onLayoutCommit}
          />
        </main>

        {/* Inspector */}
        <aside className="space-y-3">
          {selected ? (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold">Khối đã chọn</h2>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" aria-label="Xoá khối" onClick={() => removeBlock.mutate(selected.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tiêu đề</Label>
                <Input
                  value={selected.title ?? ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    qc.setQueryData(["blocks", id], (old: ReportBlock[] | undefined) =>
                      old?.map((b) => (b.id === selected.id ? { ...b, title: e.target.value } : b)),
                    )
                  }
                  onBlur={(e) => updateBlock.mutate({ blockId: selected.id, patch: { title: e.target.value } })}
                />
              </div>

              {isContainerBlock(selected) && (
                <div className="space-y-2 border-t border-border pt-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    {selected.block_type === "tabs" ? "Các thẻ" : selected.block_type === "row" ? "Hàng" : "Cột"}
                  </span>
                  {(() => {
                    const config = resolveContainerConfig(selected);
                    const slots = "tabs" in config ? config.tabs.map((t) => ({ id: t.id, label: t.label })) : config.sizes.map((_, i) => ({ id: String(i), label: `Ô ${i + 1}` }));
                    return (
                      <div className="space-y-2">
                        {slots.map((slot) => (
                          <div key={slot.id} className="space-y-1 rounded-md border border-border p-2">
                            <span className="text-[11px] text-muted-foreground">{slot.label}</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="text-[11px]"
                                disabled={!canEdit}
                                onClick={() =>
                                  addBlock.mutate({
                                    block_type: "heading",
                                    title: "Tiêu đề mục",
                                    parent_block_id: selected.id,
                                    parent_slot: slot.id,
                                  })
                                }
                              >
                                <Type className="mr-1 h-3 w-3" /> Văn bản
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="text-[11px]"
                                disabled={!canEdit || !r.connection_id}
                                onClick={() =>
                                  addBlock.mutate({
                                    block_type: "superset_chart",
                                    title: "Biểu đồ mới",
                                    parent_block_id: selected.id,
                                    parent_slot: slot.id,
                                  })
                                }
                              >
                                <Plus className="mr-1 h-3 w-3" /> Biểu đồ trống
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {!isChartBlock(selected) && !isContainerBlock(selected) && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nội dung</Label>
                  <Textarea
                    value={selected.body ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      qc.setQueryData(["blocks", id], (old: ReportBlock[] | undefined) =>
                        old?.map((b) => (b.id === selected.id ? { ...b, body: e.target.value } : b)),
                      )
                    }
                    onBlur={(e) => updateBlock.mutate({ blockId: selected.id, patch: { body: e.target.value } })}
                  />
                </div>
              )}

              {isChartBlock(selected) && (
                <>
                  {selected.block_type === "adhoc_query" && (
                    <AdhocChartEditor
                      connectionId={r.connection_id}
                      initial={{
                        datasetId: selected.dataset_id,
                        datasetName: selected.dataset_name,
                        groupby: Array.isArray(selected.adhoc_groupby) ? (selected.adhoc_groupby as string[]) : [],
                        metrics: Array.isArray(selected.adhoc_metrics) ? (selected.adhoc_metrics as never[]) : [],
                        rowLimit: selected.row_limit,
                        orderDesc: selected.adhoc_order_desc,
                      }}
                      onSave={(result: AdhocChartResult) =>
                        updateBlock.mutate({
                          blockId: selected.id,
                          patch: {
                            dataset_id: result.datasetId,
                            dataset_name: result.datasetName,
                            adhoc_groupby: result.groupby,
                            adhoc_metrics: result.metrics,
                            row_limit: result.rowLimit,
                            adhoc_order_desc: result.orderDesc,
                          },
                        })
                      }
                      trigger={
                        <Button variant="secondary" size="sm" className="w-full" disabled={!canEdit}>
                          Sửa nguồn dữ liệu
                        </Button>
                      }
                    />
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Kiểu biểu đồ</Label>
                    <Select
                      value={selected.chart_kind}
                      onValueChange={(v) => updateBlock.mutate({ blockId: selected.id, patch: { chart_kind: v } })}
                      disabled={!canEdit}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CHART_KINDS.map((k) => (
                          <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Giới hạn dòng: {selected.row_limit}</Label>
                    <Slider
                      value={[selected.row_limit]}
                      min={10}
                      max={5000}
                      step={10}
                      disabled={!canEdit}
                      onValueCommit={([v]) => updateBlock.mutate({ blockId: selected.id, patch: { row_limit: v ?? selected.row_limit } })}
                    />
                  </div>

                  <div className="border-t border-border pt-3">
                    <StyleInspector
                      kind={selected.chart_kind}
                      style={selectedStyle}
                      theme={theme}
                      columns={selectedColumns.data ?? []}
                      disabled={!canEdit}
                      onChange={(patch) => applyStyle(selected.id, selectedStyle, patch)}
                      onReset={() => updateBlock.mutate({ blockId: selected.id, patch: { style_config: {} } })}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Vị trí ({viewport === "lg" ? "Máy tính" : viewport === "md" ? "Máy tính bảng" : "Điện thoại"})
                  </span>
                  {viewport !== "lg" && canEdit && selectedLayout && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => {
                        const lgPos = selectedLayout.lg!;
                        const nextLayout = { ...selectedLayout, [viewport]: { ...lgPos, w: Math.min(12, lgPos.w) } };
                        onLayoutCommit([{ id: selected.id, layout: nextLayout }]);
                      }}
                    >
                      Sao chép từ Máy tính
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Kéo-thả hoặc kéo cạnh khối trên canvas để đổi vị trí/kích thước, hoặc chỉnh trực tiếp:
                </p>
                {selectedLayout && (() => {
                  const pos = selectedLayout[viewport]!;
                  const setPos = (patch: Partial<typeof pos>) => {
                    const nextLayout = { ...selectedLayout, [viewport]: { ...pos, ...patch } };
                    onLayoutCommit([{ id: selected.id, layout: nextLayout }]);
                  };
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">X (cột)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={11}
                          value={pos.x}
                          disabled={!canEdit}
                          onChange={(e) => setPos({ x: Number(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Y (hàng)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={pos.y}
                          disabled={!canEdit}
                          onChange={(e) => setPos({ y: Number(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Rộng (cột)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={12}
                          value={pos.w}
                          disabled={!canEdit}
                          onChange={(e) => setPos({ w: Math.min(12, Math.max(1, Number(e.target.value) || 1)) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Cao (hàng)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={pos.h}
                          disabled={!canEdit}
                          onChange={(e) => setPos({ h: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  Hiện tiêu đề
                  <Switch
                    checked={selected.show_title}
                    disabled={!canEdit}
                    onCheckedChange={(v) => updateBlock.mutate({ blockId: selected.id, patch: { show_title: v } })}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  Ẩn trên điện thoại
                  <Switch
                    checked={selected.hide_on_mobile}
                    disabled={!canEdit}
                    onCheckedChange={(v) => updateBlock.mutate({ blockId: selected.id, patch: { hide_on_mobile: v } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Màu nền riêng</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      aria-label="Màu nền khối"
                      value={selected.background_color ?? theme.surface_color}
                      onChange={(e) => updateBlock.mutate({ blockId: selected.id, patch: { background_color: e.target.value } })}
                      className="h-9 w-10 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateBlock.mutate({ blockId: selected.id, patch: { background_color: null } })}
                    >
                      Theo chủ đề
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Chọn một khối trên canvas để chỉnh sửa.
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
