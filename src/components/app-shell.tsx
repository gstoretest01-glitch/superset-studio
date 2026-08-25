import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, LayoutGrid, Palette, Plug, LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/reports", label: "Báo cáo", icon: LayoutGrid },
  { to: "/themes", label: "Chủ đề", icon: Palette },
  { to: "/connections", label: "Kết nối", icon: Plug },
] as const;

export function useMyRole() {
  return useQuery({
    queryKey: ["my-role"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return { role: "viewer", email: "" };
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id)
        .order("role", { ascending: true });
      const roles = (data ?? []).map((r) => r.role as string);
      const role = roles.includes("admin") ? "admin" : roles.includes("editor") ? "editor" : "viewer";
      return { role, email: auth.user.email ?? "" };
    },
    staleTime: 5 * 60_000,
  });
}

export function AppShell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const navigate = useNavigate();
  const { data } = useMyRole();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-4 px-4">
          <Link to="/reports" className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-display text-sm font-semibold">Report Studio</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <span className="hidden text-xs text-muted-foreground md:inline">
              {data?.email} · {data?.role}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Đăng xuất"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
