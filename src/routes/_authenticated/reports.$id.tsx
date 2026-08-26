import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Monitor,
  Plus,
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
import { resolveStyle, type BlockStyle } from "@/lib/block-style";
import { CHART_KINDS, FALLBACK_THEME, type Report, type ReportBlock, type ReportTheme } from "@/lib/report-types";
import { getChartData, listCharts } from "@/lib/superset.functions";

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
      // types.ts (tự sinh bởi Lovable Cloud) chưa có cột layout/dataset_id/adhoc_* —
      // sẽ tự cập nhật sau khi migration được áp dụng. Cast qua unknown tạm thời.
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
      const position = (blocks.data?.length ?? 0) + 1;
      // types.ts chưa có cột layout/dataset_id/adhoc_* — cast tạm qua unknown cho đến khi
      // Lovable Cloud tự regenerate sau khi migration được áp dụng.
      const { data, error } = await supabase
        .from("report_blocks")
        .insert({ report_id: id, position, ...patch } as unknown as never)
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
      // types.ts chưa có cột layout/dataset_id/adhoc_* — cast tạm qua unknown cho đến khi
      // Lovable Cloud tự regenerate sau khi migration được áp dụng.
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

  const move = useMutation({
    mutationFn: async ({ blockId, dir }: { blockId: string; dir: -1 | 1 }) => {
      const list = [...(blocks.data ?? [])];
      const index = list.findIndex((b) => b.id === blockId);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= list.length) return;
      const a = list[index]!;
      const b = list[target]!;
      await supabase.from("report_blocks").update({ position: b.position }).eq("id", a.id);
      await supabase.from("report_blocks").update({ position: a.position }).eq("id", b.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocks", id] }),
  });

  const fetcher = useMemo(
    () => async (block: ReportBlock) => {
      if (!report.data?.connection_id || block.chart_id == null) {
        return { columns: [], rows: [], error: "Báo cáo chưa gắn kết nối Superset." };
      }
      return fetchChartData({
        data: {
          connectionId: report.data.connection_id,
          chartId: block.chart_id,
          rowLimit: block.row_limit,
        },
      });
    },
    [fetchChartData, report.data?.connection_id],
  );

  const selectedStyle = resolveStyle(selected?.style_config);

  const selectedColumns = useQuery({
    queryKey: ["block-columns", selected?.id, selected?.chart_id, report.data?.connection_id],
    enabled: Boolean(selected?.chart_id && report.data?.connection_id),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetchChartData({
        data: {
          connectionId: report.data!.connection_id!,
          chartId: selected!.chart_id!,
          rowLimit: 10,
        },
      });
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
          />
        </main>

        {/* Inspector */}
        <aside className="space-y-3">
          {selected ? (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold">Khối đã chọn</h2>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" aria-label="Lên" onClick={() => move.mutate({ blockId: selected.id, dir: -1 })}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Xuống" onClick={() => move.mutate({ blockId: selected.id, dir: 1 })}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
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

              {selected.block_type !== "superset_chart" && (
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

              {selected.block_type === "superset_chart" && (
                <>
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
                <span className="text-xs font-medium text-muted-foreground">Kích thước theo màn hình</span>
                {(
                  [
                    ["span_lg", "Máy tính"],
                    ["span_md", "Máy tính bảng"],
                    ["span_sm", "Điện thoại"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {label}: {selected[key]}/12 cột
                    </Label>
                    <Slider
                      value={[selected[key]]}
                      min={1}
                      max={12}
                      step={1}
                      disabled={!canEdit}
                      onValueChange={([v]) =>
                        qc.setQueryData(["blocks", id], (old: ReportBlock[] | undefined) =>
                          old?.map((b) => (b.id === selected.id ? { ...b, [key]: v } : b)),
                        )
                      }
                      onValueCommit={([v]) => updateBlock.mutate({ blockId: selected.id, patch: { [key]: v ?? selected[key] } })}
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Chiều cao: {selected.height_px}px</Label>
                  <Slider
                    value={[selected.height_px]}
                    min={120}
                    max={800}
                    step={10}
                    disabled={!canEdit}
                    onValueChange={([v]) =>
                      qc.setQueryData(["blocks", id], (old: ReportBlock[] | undefined) =>
                        old?.map((b) => (b.id === selected.id ? { ...b, height_px: v } : b)),
                      )
                    }
                    onValueCommit={([v]) => updateBlock.mutate({ blockId: selected.id, patch: { height_px: v ?? selected.height_px } })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Chiều cao trên điện thoại: {selected.height_sm_px}px</Label>
                  <Slider
                    value={[selected.height_sm_px]}
                    min={100}
                    max={600}
                    step={10}
                    disabled={!canEdit}
                    onValueChange={([v]) =>
                      qc.setQueryData(["blocks", id], (old: ReportBlock[] | undefined) =>
                        old?.map((b) => (b.id === selected.id ? { ...b, height_sm_px: v } : b)),
                      )
                    }
                    onValueCommit={([v]) => updateBlock.mutate({ blockId: selected.id, patch: { height_sm_px: v ?? selected.height_sm_px } })}
                  />
                </div>
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
