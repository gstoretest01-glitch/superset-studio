import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, useMyRole } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import type { ReportTheme } from "@/lib/report-types";

export const Route = createFileRoute("/_authenticated/themes")({
  head: () => ({
    meta: [
      { title: "Chủ đề báo cáo — Report Studio" },
      { name: "description", content: "Tuỳ chỉnh bảng màu, phông chữ, bo góc và khoảng cách cho báo cáo Superset." },
      { property: "og:title", content: "Chủ đề báo cáo — Report Studio" },
      { property: "og:description", content: "Tuỳ chỉnh bảng màu và kích thước hiển thị của báo cáo." },
    ],
  }),
  component: ThemesPage,
});

const COLOR_FIELDS: Array<[keyof ReportTheme, string]> = [
  ["page_color", "Nền trang"],
  ["surface_color", "Nền khối"],
  ["border_color", "Đường viền"],
  ["text_color", "Chữ chính"],
  ["muted_text_color", "Chữ phụ"],
  ["accent_color", "Màu nhấn"],
];

function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
      </div>
    </div>
  );
}

function ThemesPage() {
  const qc = useQueryClient();
  const { data: me } = useMyRole();
  const canEdit = me?.role === "admin" || me?.role === "editor";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReportTheme | null>(null);

  const themes = useQuery({
    queryKey: ["themes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("report_themes").select("*").order("created_at");
      if (error) throw error;
      return data as ReportTheme[];
    },
  });

  useEffect(() => {
    if (!themes.data?.length) return;
    const next = themes.data.find((t) => t.id === selectedId) ?? themes.data[0]!;
    setSelectedId(next.id);
    setDraft(next);
  }, [themes.data, selectedId]);

  const save = useMutation({
    mutationFn: async (theme: ReportTheme) => {
      const { id, ...patch } = theme;
      const { error } = await supabase.from("report_themes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["themes"] });
      toast.success("Đã lưu chủ đề");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("report_themes")
        .insert({ name: `Chủ đề ${(themes.data?.length ?? 0) + 1}` })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      setSelectedId(id);
      qc.invalidateQueries({ queryKey: ["themes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("report_themes").update({ is_default: false }).neq("id", id);
      const { error } = await supabase.from("report_themes").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["themes"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_themes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["themes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      actions={
        canEdit ? (
          <Button size="sm" variant="secondary" onClick={() => create.mutate()}>
            <Plus className="mr-1 h-4 w-4" /> Chủ đề mới
          </Button>
        ) : null
      }
    >
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Chủ đề</h1>
        <p className="text-sm text-muted-foreground">Màu sắc, phông chữ và kích thước áp dụng cho mọi khối báo cáo.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr_1fr]">
        <aside className="space-y-1.5">
          {themes.data?.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                t.id === selectedId ? "border-primary bg-secondary" : "border-border hover:bg-secondary/60"
              }`}
            >
              <span className="flex gap-0.5">
                {t.palette.slice(0, 3).map((c, i) => (
                  <span key={i} className="h-3 w-3 rounded-sm" style={{ background: c }} />
                ))}
              </span>
              <span className="flex-1 truncate">{t.name}</span>
              {t.is_default && <Star className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </aside>

        {draft && (
          <>
            <section className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="space-y-2">
                <Label>Tên chủ đề</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} disabled={!canEdit} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {COLOR_FIELDS.map(([key, label]) => (
                  <ColorInput
                    key={key}
                    label={label}
                    value={String(draft[key] ?? "#000000")}
                    onChange={(v) => setDraft({ ...draft, [key]: v })}
                  />
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Bảng màu biểu đồ</Label>
                <div className="flex flex-wrap gap-2">
                  {draft.palette.map((c, i) => (
                    <input
                      key={i}
                      type="color"
                      aria-label={`Màu ${i + 1}`}
                      value={c}
                      onChange={(e) => {
                        const next = [...draft.palette];
                        next[i] = e.target.value;
                        setDraft({ ...draft, palette: next });
                      }}
                      className="h-8 w-8 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
                    />
                  ))}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Thêm màu"
                    onClick={() => setDraft({ ...draft, palette: [...draft.palette, "#22d3ee"] })}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {draft.palette.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Bớt màu"
                      onClick={() => setDraft({ ...draft, palette: draft.palette.slice(0, -1) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Phông chữ</Label>
                <Input value={draft.font_family} onChange={(e) => setDraft({ ...draft, font_family: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Bo góc: {draft.radius_px}px</Label>
                <Slider
                  value={[draft.radius_px]}
                  min={0}
                  max={32}
                  step={1}
                  onValueChange={([v]) => setDraft({ ...draft, radius_px: v ?? 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Khoảng cách lưới: {draft.gap_px}px</Label>
                <Slider
                  value={[draft.gap_px]}
                  min={0}
                  max={40}
                  step={2}
                  onValueChange={([v]) => setDraft({ ...draft, gap_px: v ?? 0 })}
                />
              </div>

              {canEdit && (
                <div className="flex gap-2">
                  <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
                    Lưu
                  </Button>
                  <Button variant="secondary" onClick={() => setDefault.mutate(draft.id)} disabled={draft.is_default}>
                    Đặt mặc định
                  </Button>
                  <Button variant="ghost" className="ml-auto" onClick={() => remove.mutate(draft.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </section>

            <section
              className="space-y-3 rounded-xl p-5"
              style={{ background: draft.page_color, border: `1px solid ${draft.border_color}` }}
            >
              <span className="text-xs uppercase tracking-widest" style={{ color: draft.muted_text_color }}>
                Xem trước
              </span>
              <div
                className="space-y-3 p-4"
                style={{
                  background: draft.surface_color,
                  border: `1px solid ${draft.border_color}`,
                  borderRadius: draft.radius_px,
                }}
              >
                <h3 className="text-base font-semibold" style={{ color: draft.text_color, fontFamily: draft.font_family }}>
                  Doanh thu theo kênh
                </h3>
                <div className="flex h-32 items-end gap-2">
                  {[62, 88, 45, 74, 96, 53].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{ height: `${h}%`, background: draft.palette[i % draft.palette.length] }}
                    />
                  ))}
                </div>
                <p className="text-xs" style={{ color: draft.muted_text_color }}>
                  Cập nhật gần nhất hôm nay
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
