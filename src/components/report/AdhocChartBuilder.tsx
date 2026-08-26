import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ChartRenderer } from "./ChartRenderer";
import { Choice, Field, NumSlider, Row } from "./inspector-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FALLBACK_THEME } from "@/lib/report-types";
import { getAdhocChartData, getDatasetDetail, listDatasets } from "@/lib/superset.functions";

const AGGREGATES = [
  { value: "SUM", label: "Tổng" },
  { value: "COUNT", label: "Đếm" },
  { value: "AVG", label: "Trung bình" },
  { value: "MIN", label: "Nhỏ nhất" },
  { value: "MAX", label: "Lớn nhất" },
  { value: "COUNT_DISTINCT", label: "Đếm duy nhất" },
] as const;

type Aggregate = (typeof AGGREGATES)[number]["value"];

export type AdhocMetricInput = { column: string; aggregate: Aggregate; label?: string };

export type AdhocChartResult = {
  datasetId: number;
  datasetName: string;
  groupby: string[];
  metrics: AdhocMetricInput[];
  rowLimit: number;
  orderDesc: boolean;
  title: string;
};

export type AdhocChartBuilderInitial = {
  datasetId: number | null;
  datasetName: string | null;
  groupby: string[];
  metrics: AdhocMetricInput[];
  rowLimit: number;
  orderDesc: boolean;
};

function useDatasetSearch(connectionId: string | null, search: string) {
  const fetchDatasets = useServerFn(listDatasets);
  return useQuery({
    queryKey: ["superset-datasets", connectionId, search],
    queryFn: () => fetchDatasets({ data: { connectionId: connectionId!, search } }),
    enabled: Boolean(connectionId),
    staleTime: 60_000,
  });
}

function useDatasetDetail(connectionId: string | null, datasetId: number | null) {
  const fetchDetail = useServerFn(getDatasetDetail);
  return useQuery({
    queryKey: ["dataset-detail", connectionId, datasetId],
    queryFn: () => fetchDetail({ data: { connectionId: connectionId!, datasetId: datasetId! } }),
    enabled: Boolean(connectionId && datasetId),
    staleTime: 5 * 60_000,
  });
}

/** Nội dung form chọn dataset + groupby + metric, dùng chung cho chế độ tạo mới và sửa. */
function AdhocChartForm({
  connectionId,
  initial,
  onSubmit,
  submitLabel,
}: {
  connectionId: string | null;
  initial?: AdhocChartBuilderInitial | undefined;
  onSubmit: (result: AdhocChartResult) => void;
  submitLabel: string;
}) {
  const [search, setSearch] = useState("");
  const [datasetId, setDatasetId] = useState<number | null>(initial?.datasetId ?? null);
  const [datasetName, setDatasetName] = useState<string | null>(initial?.datasetName ?? null);
  const [groupby, setGroupby] = useState<string[]>(initial?.groupby ?? []);
  const [metrics, setMetrics] = useState<AdhocMetricInput[]>(initial?.metrics ?? []);
  const [rowLimit, setRowLimit] = useState(initial?.rowLimit ?? 500);
  const [orderDesc, setOrderDesc] = useState(initial?.orderDesc ?? true);

  const datasets = useDatasetSearch(connectionId, search);
  const detail = useDatasetDetail(connectionId, datasetId);
  const fetchAdhoc = useServerFn(getAdhocChartData);

  useEffect(() => {
    setGroupby((prev) => prev.filter((c) => detail.data?.detail?.columns.some((col) => col.name === c)));
  }, [detail.data]);

  const preview = useQuery({
    queryKey: ["adhoc-preview", connectionId, datasetId, groupby, metrics, rowLimit, orderDesc],
    queryFn: () =>
      fetchAdhoc({
        data: {
          connectionId: connectionId!,
          datasetId: datasetId!,
          groupby,
          metrics,
          rowLimit,
          orderDesc,
        },
      }),
    enabled: Boolean(connectionId && datasetId && groupby.length > 0 && metrics.length > 0),
    staleTime: 10_000,
  });

  const canSubmit = Boolean(datasetId && groupby.length > 0 && metrics.length > 0);

  const columns = detail.data?.detail?.columns ?? [];
  const savedMetrics = detail.data?.detail?.metrics ?? [];

  return (
    <div className="space-y-4">
      {!datasetId ? (
        <div className="space-y-2">
          <Input
            placeholder="Tìm tập dữ liệu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="scroll-thin max-h-72 space-y-1 overflow-auto">
            {!connectionId && <p className="text-xs text-muted-foreground">Hãy chọn kết nối trước.</p>}
            {datasets.data?.error && <p className="text-xs text-destructive">{datasets.data.error}</p>}
            {datasets.data?.datasets?.map((d) => (
              <button
                key={d.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md border border-border px-2.5 py-2 text-left text-xs transition-colors hover:border-primary/60 hover:bg-secondary"
                onClick={() => {
                  setDatasetId(d.id);
                  setDatasetName(d.name);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                <span className="text-[10px] text-muted-foreground">{d.database}</span>
              </button>
            ))}
            {datasets.data && datasets.data.datasets.length === 0 && !datasets.data.error && (
              <p className="text-xs text-muted-foreground">Không tìm thấy tập dữ liệu nào.</p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <span className="text-sm font-medium">{datasetName}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setDatasetId(null);
                setDatasetName(null);
                setGroupby([]);
                setMetrics([]);
              }}
            >
              Đổi tập dữ liệu
            </Button>
          </div>

          {detail.isPending && <p className="text-xs text-muted-foreground">Đang tải cột dữ liệu…</p>}
          {detail.data?.error && <p className="text-xs text-destructive">{detail.data.error}</p>}

          {columns.length > 0 && (
            <>
              <Field label="Chiều (groupby)">
                <div className="scroll-thin max-h-32 space-y-1 overflow-auto rounded-md border border-border p-2">
                  {columns
                    .filter((c) => c.groupby)
                    .map((c) => (
                      <label key={c.name} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">{c.name}</span>
                        <Switch
                          checked={groupby.includes(c.name)}
                          onCheckedChange={(v) =>
                            setGroupby((prev) => (v ? [...prev, c.name] : prev.filter((x) => x !== c.name)))
                          }
                        />
                      </label>
                    ))}
                </div>
              </Field>

              <Field label="Số liệu (metric)">
                <div className="space-y-2">
                  {metrics.map((m, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Choice
                        value={m.column}
                        options={columns.map((c) => ({ value: c.name, label: c.name }))}
                        onChange={(v) =>
                          setMetrics((prev) => prev.map((mm, ii) => (ii === i ? { ...mm, column: v } : mm)))
                        }
                      />
                      <Choice
                        value={m.aggregate}
                        options={AGGREGATES.map((a) => ({ value: a.value, label: a.label }))}
                        onChange={(v) =>
                          setMetrics((prev) => prev.map((mm, ii) => (ii === i ? { ...mm, aggregate: v } : mm)))
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label="Xoá số liệu"
                        onClick={() => setMetrics((prev) => prev.filter((_, ii) => ii !== i))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={columns.length === 0}
                    onClick={() =>
                      setMetrics((prev) => [
                        ...prev,
                        { column: columns[0]!.name, aggregate: "SUM" as Aggregate },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Thêm số liệu
                  </Button>
                  {savedMetrics.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Metric có sẵn trong Superset: {savedMetrics.map((m) => m.label).join(", ")}
                    </p>
                  )}
                </div>
              </Field>

              <NumSlider
                label="Giới hạn dòng"
                value={rowLimit}
                min={10}
                max={5000}
                step={10}
                onCommit={setRowLimit}
              />
              <Row label="Sắp xếp giảm dần">
                <Switch checked={orderDesc} onCheckedChange={setOrderDesc} />
              </Row>

              <div className="h-44 rounded-md border border-border p-2">
                {!canSubmit ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Chọn ít nhất 1 chiều và 1 số liệu để xem trước
                  </div>
                ) : preview.isPending ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Đang tải dữ liệu…
                  </div>
                ) : preview.data?.error ? (
                  <div className="flex h-full items-center justify-center text-xs text-destructive">
                    {preview.data.error}
                  </div>
                ) : (
                  <ChartRenderer
                    kind="auto"
                    columns={preview.data?.columns ?? []}
                    rows={preview.data?.rows ?? []}
                    theme={FALLBACK_THEME}
                    compact
                  />
                )}
              </div>
            </>
          )}
        </>
      )}

      <DialogFooter>
        <Button
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({
              datasetId: datasetId!,
              datasetName: datasetName!,
              groupby,
              metrics,
              rowLimit,
              orderDesc,
              title: `${datasetName} — ${metrics.map((m) => `${m.aggregate}(${m.column})`).join(", ")}`,
            })
          }
        >
          {submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}

/** Dialog tạo biểu đồ mới từ dataset Superset — không cần chart có sẵn. */
export function AdhocChartBuilder({
  connectionId,
  onCreate,
  disabled,
}: {
  connectionId: string | null;
  onCreate: (result: AdhocChartResult) => void;
  disabled?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="w-full" disabled={disabled}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Tạo biểu đồ mới
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo biểu đồ mới từ tập dữ liệu</DialogTitle>
        </DialogHeader>
        <AdhocChartForm
          connectionId={connectionId}
          onSubmit={(result) => {
            onCreate(result);
            setOpen(false);
          }}
          submitLabel="Thêm vào báo cáo"
        />
      </DialogContent>
    </Dialog>
  );
}

/** Dialog sửa lại metric/groupby của một khối adhoc_query đã có. */
export function AdhocChartEditor({
  connectionId,
  initial,
  onSave,
  trigger,
}: {
  connectionId: string | null;
  initial: AdhocChartBuilderInitial;
  onSave: (result: AdhocChartResult) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sửa biểu đồ</DialogTitle>
        </DialogHeader>
        <AdhocChartForm
          connectionId={connectionId}
          initial={initial}
          onSubmit={(result) => {
            onSave(result);
            setOpen(false);
          }}
          submitLabel="Lưu thay đổi"
        />
      </DialogContent>
    </Dialog>
  );
}
