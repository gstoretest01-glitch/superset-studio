import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, useMyRole } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Report } from "@/lib/report-types";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({
    meta: [
      { title: "Danh sách báo cáo — Report Studio" },
      { name: "description", content: "Quản lý toàn bộ báo cáo Superset responsive của tổ chức." },
      { property: "og:title", content: "Danh sách báo cáo — Report Studio" },
      { property: "og:description", content: "Quản lý toàn bộ báo cáo Superset responsive của tổ chức." },
    ],
  }),
  component: ReportsPage,
});

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function ReportsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useMyRole();
  const canEdit = me?.role === "admin" || me?.role === "editor";
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const reports = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, slug, title, description, theme_id, connection_id, is_published, grid_columns, max_width_px, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Report[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: theme } = await supabase.from("report_themes").select("id").eq("is_default", true).maybeSingle();
      const { data: conn } = await supabase.from("superset_connections").select("id").eq("is_default", true).maybeSingle();
      const { data, error } = await supabase
        .from("reports")
        .insert({
          title,
          slug: `${slugify(title) || "bao-cao"}-${Math.random().toString(36).slice(2, 6)}`,
          created_by: auth.user?.id ?? null,
          theme_id: theme?.id ?? null,
          connection_id: conn?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      setOpen(false);
      setTitle("");
      qc.invalidateQueries({ queryKey: ["reports"] });
      navigate({ to: "/reports/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      actions={
        canEdit ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> Báo cáo mới
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tạo báo cáo</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="t">Tiêu đề</Label>
                <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Báo cáo doanh thu tháng" />
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!title.trim() || create.isPending}>
                  Tạo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Báo cáo</h1>
        <p className="text-sm text-muted-foreground">
          Thiết kế bố cục responsive cho biểu đồ Superset và chia sẻ công khai.
        </p>
      </div>

      {reports.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : reports.data && reports.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reports.data.map((r) => (
            <article
              key={r.id}
              className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-2">
                <Link to="/reports/$id" params={{ id: r.id }} className="font-display text-base font-semibold">
                  {r.title}
                </Link>
                <Badge variant={r.is_published ? "default" : "secondary"}>
                  {r.is_published ? "Đã xuất bản" : "Nháp"}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">
                {r.description || "Chưa có mô tả"}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link to="/reports/$id" params={{ id: r.id }}>Chỉnh sửa</Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <a href={`/r/${r.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Xem
                  </a>
                </Button>
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    aria-label="Xoá báo cáo"
                    onClick={() => remove.mutate(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Chưa có báo cáo nào. Hãy tạo báo cáo đầu tiên.
        </div>
      )}
    </AppShell>
  );
}
