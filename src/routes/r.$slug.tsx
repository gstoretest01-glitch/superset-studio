import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";

import { ReportCanvas } from "@/components/report/ReportCanvas";
import { supabase } from "@/integrations/supabase/client";
import { FALLBACK_THEME, type Report, type ReportBlock, type ReportTheme } from "@/lib/report-types";
import { getPublicBlockData } from "@/lib/superset.functions";

export const Route = createFileRoute("/r/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Báo cáo ${params.slug} — Report Studio` },
      { name: "description", content: "Báo cáo Superset responsive được chia sẻ công khai từ Report Studio." },
      { property: "og:title", content: `Báo cáo ${params.slug} — Report Studio` },
      { property: "og:description", content: "Báo cáo Superset responsive chia sẻ công khai." },
    ],
  }),
  component: PublicReportPage,
  notFoundComponent: () => (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Không tìm thấy báo cáo</h1>
        <p className="mt-2 text-sm text-muted-foreground">Báo cáo chưa được xuất bản hoặc liên kết không đúng.</p>
      </div>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </main>
  ),
});

function PublicReportPage() {
  const { slug } = Route.useParams();
  const fetchPublicData = useServerFn(getPublicBlockData);

  const data = useQuery({
    queryKey: ["public-report", slug],
    queryFn: async () => {
      const { data: report, error } = await supabase
        .from("reports")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      if (!report) throw notFound();

      const [{ data: blocks }, { data: theme }] = await Promise.all([
        supabase.from("report_blocks").select("*").eq("report_id", report.id).order("position"),
        report.theme_id
          ? supabase.from("report_themes").select("*").eq("id", report.theme_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return {
        report: report as Report,
        blocks: (blocks ?? []) as ReportBlock[],
        theme: (theme as ReportTheme | null) ?? FALLBACK_THEME,
      };
    },
  });

  const fetcher = useMemo(
    () => (block: ReportBlock) => fetchPublicData({ data: { blockId: block.id } }),
    [fetchPublicData],
  );

  if (data.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground">Đang tải báo cáo…</span>
      </main>
    );
  }

  const { report, blocks, theme } = data.data!;

  return (
    <main className="min-h-screen" style={{ background: theme.page_color, color: theme.text_color }}>
      <header
        className="mx-auto w-full px-4 pt-8 pb-2 sm:px-6"
        style={{ maxWidth: report.max_width_px, fontFamily: theme.font_family }}
      >
        <h1 className="text-2xl font-semibold sm:text-3xl">{report.title}</h1>
        {report.description && (
          <p className="mt-2 max-w-3xl text-sm" style={{ color: theme.muted_text_color }}>
            {report.description}
          </p>
        )}
      </header>
      <ReportCanvas blocks={blocks} theme={theme} fetcher={fetcher} maxWidth={report.max_width_px} />
      <footer
        className="mx-auto w-full px-4 pb-10 text-xs sm:px-6"
        style={{ maxWidth: report.max_width_px, color: theme.muted_text_color }}
      >
        Tạo bằng Report Studio · dữ liệu từ Apache Superset
      </footer>
    </main>
  );
}
