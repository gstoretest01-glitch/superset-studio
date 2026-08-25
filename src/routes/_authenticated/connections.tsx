import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Plus, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, useMyRole } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { testSupersetConnection } from "@/lib/superset.functions";

export const Route = createFileRoute("/_authenticated/connections")({
  head: () => ({
    meta: [
      { title: "Kết nối Superset — Report Studio" },
      { name: "description", content: "Cấu hình máy chủ Apache Superset và tài khoản dịch vụ dùng để lấy dữ liệu biểu đồ." },
      { property: "og:title", content: "Kết nối Superset — Report Studio" },
      { property: "og:description", content: "Cấu hình máy chủ Apache Superset cho hệ thống báo cáo." },
    ],
  }),
  component: ConnectionsPage,
});

type Conn = {
  id: string;
  name: string;
  base_url: string;
  service_username: string;
  auth_provider: string;
  is_default: boolean;
  last_status: string | null;
  last_checked_at: string | null;
};

function ConnectionsPage() {
  const qc = useQueryClient();
  const { data: me } = useMyRole();
  const isAdmin = me?.role === "admin";
  const testFn = useServerFn(testSupersetConnection);
  const [form, setForm] = useState({ name: "", base_url: "", service_username: "", auth_provider: "db" });

  const list = useQuery({
    queryKey: ["connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("superset_connections")
        .select("id, name, base_url, service_username, auth_provider, is_default, last_status, last_checked_at")
        .order("created_at");
      if (error) throw error;
      return data as Conn[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("superset_connections").insert({
        name: form.name,
        base_url: form.base_url.replace(/\/+$/, ""),
        service_username: form.service_username,
        auth_provider: form.auth_provider,
        is_default: (list.data?.length ?? 0) === 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ name: "", base_url: "", service_username: "", auth_provider: "db" });
      qc.invalidateQueries({ queryKey: ["connections"] });
      toast.success("Đã thêm kết nối");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Conn> }) => {
      if (patch.is_default) {
        await supabase.from("superset_connections").update({ is_default: false }).neq("id", id);
      }
      const { error } = await supabase.from("superset_connections").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("superset_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: (id: string) => testFn({ data: { connectionId: id } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["connections"] });
      res.ok ? toast.success("Kết nối thành công") : toast.error(res.message ?? "Kết nối thất bại");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Kết nối Superset</h1>
        <p className="text-sm text-muted-foreground">
          Mật khẩu tài khoản dịch vụ được lưu an toàn ở phía máy chủ (SUPERSET_SERVICE_PASSWORD).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {list.data?.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.last_status === "ok" ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : c.last_status ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.base_url} · {c.service_username || "chưa có tài khoản dịch vụ"} · {c.auth_provider}
                  </p>
                  {c.last_status && c.last_status !== "ok" && (
                    <p className="mt-1 text-xs text-destructive">{c.last_status}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    Mặc định
                    <Switch
                      checked={c.is_default}
                      disabled={!isAdmin}
                      onCheckedChange={(v) => update.mutate({ id: c.id, patch: { is_default: v } })}
                    />
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => test.mutate(c.id)} disabled={test.isPending}>
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Kiểm tra
                  </Button>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" aria-label="Xoá" onClick={() => remove.mutate(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {list.data?.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Chưa có kết nối nào.
            </div>
          )}
        </div>

        {isAdmin && (
          <form
            className="h-fit space-y-4 rounded-xl border border-border bg-card p-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <h2 className="font-display text-sm font-semibold">Thêm kết nối</h2>
            <div className="space-y-2">
              <Label htmlFor="n">Tên</Label>
              <Input id="n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u">Địa chỉ Superset</Label>
              <Input
                id="u"
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                placeholder="https://superset.congty.vn"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s">Tài khoản dịch vụ</Label>
              <Input
                id="s"
                value={form.service_username}
                onChange={(e) => setForm({ ...form, service_username: e.target.value })}
                placeholder="report_service"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p">Provider</Label>
              <Input id="p" value={form.auth_provider} onChange={(e) => setForm({ ...form, auth_provider: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={save.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Thêm
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
