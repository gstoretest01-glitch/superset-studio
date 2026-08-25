import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, LayoutGrid, Palette, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Report Studio — Báo cáo Superset responsive" },
      {
        name: "description",
        content:
          "Thiết lập báo cáo từ biểu đồ Apache Superset: tự chọn bố cục, màu sắc, kích thước và hiển thị mượt trên mọi thiết bị.",
      },
      { property: "og:title", content: "Report Studio — Báo cáo Superset responsive" },
      {
        property: "og:description",
        content: "Nhúng từng biểu đồ Superset vào lưới 12 cột do bạn tự kiểm soát màu sắc và kích thước.",
      },
    ],
  }),
  component: LandingPage,
});

const FEATURES = [
  {
    icon: LayoutGrid,
    title: "Lưới 12 cột tự chủ",
    body: "Mỗi khối có số cột riêng cho máy tính, máy tính bảng và điện thoại — không phụ thuộc lưới cố định của Superset.",
  },
  {
    icon: Palette,
    title: "Chủ đề tập trung",
    body: "Bảng màu, phông chữ, bo góc, khoảng cách áp dụng đồng bộ cho toàn bộ báo cáo, xem trước tức thì.",
  },
  {
    icon: Smartphone,
    title: "Thật sự responsive",
    body: "Biểu đồ được vẽ lại bằng dữ liệu thô từ Superset nên co giãn mượt, có thể ẩn khối trên điện thoại.",
  },
];

function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-5">
        <BarChart3 className="h-5 w-5 text-primary" />
        <span className="font-display text-sm font-semibold">Report Studio</span>
        <Button asChild size="sm" className="ml-auto">
          <Link to="/auth">Đăng nhập</Link>
        </Button>
      </header>

      <section className="mx-auto w-full max-w-6xl px-5 pt-16 pb-20">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">Apache Superset · bản miễn phí</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight font-semibold sm:text-6xl">
          Báo cáo Superset, bố cục và màu sắc do bạn quyết định.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground">
          Superset chưa hỗ trợ responsive. Report Studio nhúng từng biểu đồ vào lưới riêng, tự vẽ lại
          bằng dữ liệu thô và cho phép tinh chỉnh kích thước cho từng khổ màn hình.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/reports">Vào không gian báo cáo</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/connections">Cấu hình kết nối</Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="h-5 w-5 text-primary" />
              <h2 className="mt-3 font-display text-base font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
