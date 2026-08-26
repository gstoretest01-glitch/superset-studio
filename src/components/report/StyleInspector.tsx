import { RotateCcw } from "lucide-react";

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
import { DEFAULT_BLOCK_STYLE, type BlockStyle } from "@/lib/block-style";
import type { ReportTheme } from "@/lib/report-types";

type Patch = Partial<BlockStyle>;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Choice<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  disabled?: boolean | undefined;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <SelectTrigger className="h-8 w-[142px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NumSlider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number | undefined;
  suffix?: string | undefined;
  disabled?: boolean | undefined;
  onCommit: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">
        {label}: {value}
        {suffix}
      </Label>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueCommit={([v]) => onCommit(v ?? value)}
      />
    </div>
  );
}

export function StyleInspector({
  kind,
  style,
  theme,
  columns,
  disabled,
  onChange,
  onReset,
}: {
  kind: string;
  style: BlockStyle;
  theme: ReportTheme;
  columns: string[];
  disabled?: boolean | undefined;
  onChange: (patch: Patch) => void;
  onReset: () => void;
}) {
  const palette = style.paletteMode === "custom" && style.palette.length > 0 ? style.palette : theme.palette;
  const isCartesian = kind === "bar" || kind === "line" || kind === "area" || kind === "auto";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Giao diện riêng của khối
        </span>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={disabled} onClick={onReset}>
          <RotateCcw className="mr-1 h-3 w-3" /> Về theme
        </Button>
      </div>

      {/* Bảng màu */}
      <div className="space-y-2">
        <Row label="Bảng màu">
          <Choice
            value={style.paletteMode}
            disabled={disabled}
            options={[
              { value: "theme", label: "Theo chủ đề" },
              { value: "custom", label: "Riêng khối này" },
            ]}
            onChange={(v) =>
              onChange({
                paletteMode: v,
                ...(v === "custom" && style.palette.length === 0 ? { palette: theme.palette.slice(0, 6) } : {}),
              })
            }
          />
        </Row>
        {style.paletteMode === "custom" && (
          <div className="flex flex-wrap gap-1.5">
            {palette.map((c, i) => (
              <input
                key={i}
                type="color"
                aria-label={`Màu chuỗi ${i + 1}`}
                value={c}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...palette];
                  next[i] = e.target.value;
                  onChange({ palette: next });
                }}
                className="h-7 w-7 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
              />
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={disabled}
              onClick={() => onChange({ palette: [...palette, theme.accent_color] })}
            >
              +
            </Button>
            {palette.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                disabled={disabled}
                onClick={() => onChange({ palette: palette.slice(0, -1) })}
              >
                −
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tiêu đề */}
      <div className="space-y-2 border-t border-border pt-3">
        <Row label="Canh tiêu đề">
          <Choice
            value={style.titleAlign}
            disabled={disabled}
            options={[
              { value: "left", label: "Trái" },
              { value: "center", label: "Giữa" },
              { value: "right", label: "Phải" },
            ]}
            onChange={(v) => onChange({ titleAlign: v })}
          />
        </Row>
        <NumSlider
          label="Cỡ chữ tiêu đề"
          value={style.titleSize}
          min={11}
          max={28}
          suffix="px"
          disabled={disabled}
          onCommit={(v) => onChange({ titleSize: v })}
        />
        <Field label="Mô tả phụ">
          <Input
            className="h-8 text-xs"
            value={style.subtitle}
            disabled={disabled}
            onChange={(e) => onChange({ subtitle: e.target.value })}
          />
        </Field>
      </div>

      {/* Chú giải & số */}
      <div className="space-y-2 border-t border-border pt-3">
        <Row label="Chú giải">
          <Choice
            value={style.legend}
            disabled={disabled}
            options={[
              { value: "auto", label: "Tự động" },
              { value: "on", label: "Hiện" },
              { value: "off", label: "Ẩn" },
            ]}
            onChange={(v) => onChange({ legend: v })}
          />
        </Row>
        {style.legend !== "off" && (
          <Row label="Vị trí chú giải">
            <Choice
              value={style.legendPosition}
              disabled={disabled}
              options={[
                { value: "bottom", label: "Dưới" },
                { value: "top", label: "Trên" },
                { value: "right", label: "Phải" },
              ]}
              onChange={(v) => onChange({ legendPosition: v })}
            />
          </Row>
        )}
        <Row label="Tooltip">
          <Switch checked={style.tooltip} disabled={disabled} onCheckedChange={(v) => onChange({ tooltip: v })} />
        </Row>
        <Row label="Rút gọn số (k/tr/tỷ)">
          <Switch checked={style.compact} disabled={disabled} onCheckedChange={(v) => onChange({ compact: v })} />
        </Row>
        <NumSlider
          label="Số chữ số thập phân"
          value={style.decimals}
          min={0}
          max={4}
          disabled={disabled}
          onCommit={(v) => onChange({ decimals: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tiền tố">
            <Input
              className="h-8 text-xs"
              value={style.prefix}
              disabled={disabled}
              onChange={(e) => onChange({ prefix: e.target.value })}
            />
          </Field>
          <Field label="Hậu tố">
            <Input
              className="h-8 text-xs"
              value={style.suffix}
              disabled={disabled}
              onChange={(e) => onChange({ suffix: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Chữ khi không có dữ liệu">
          <Input
            className="h-8 text-xs"
            value={style.emptyText}
            disabled={disabled}
            onChange={(e) => onChange({ emptyText: e.target.value })}
          />
        </Field>
      </div>

      {/* Sắp xếp / top-N */}
      {kind !== "kpi" && (
        <div className="space-y-2 border-t border-border pt-3">
          <Row label="Sắp xếp">
            <Choice
              value={style.sort}
              disabled={disabled}
              options={[
                { value: "none", label: "Giữ nguyên" },
                { value: "desc", label: "Giảm dần" },
                { value: "asc", label: "Tăng dần" },
              ]}
              onChange={(v) => onChange({ sort: v })}
            />
          </Row>
          <Field label="Giới hạn top-N (để trống = tất cả)">
            <Input
              className="h-8 text-xs"
              type="number"
              min={1}
              value={style.topN ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ topN: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
        </div>
      )}

      {/* Trục */}
      {isCartesian && (
        <div className="space-y-2 border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">Trục & lưới</span>
          <Row label="Hiện trục ngang">
            <Switch checked={style.showXAxis} disabled={disabled} onCheckedChange={(v) => onChange({ showXAxis: v })} />
          </Row>
          <Row label="Hiện trục dọc">
            <Switch checked={style.showYAxis} disabled={disabled} onCheckedChange={(v) => onChange({ showYAxis: v })} />
          </Row>
          <Row label="Lưới">
            <Choice
              value={style.grid}
              disabled={disabled}
              options={[
                { value: "none", label: "Không" },
                { value: "horizontal", label: "Ngang" },
                { value: "vertical", label: "Dọc" },
                { value: "both", label: "Cả hai" },
              ]}
              onChange={(v) => onChange({ grid: v })}
            />
          </Row>
          <NumSlider
            label="Xoay nhãn trục"
            value={style.xLabelAngle}
            min={-90}
            max={0}
            step={15}
            suffix="°"
            disabled={disabled}
            onCommit={(v) => onChange({ xLabelAngle: v })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tên trục ngang">
              <Input
                className="h-8 text-xs"
                value={style.axisTitleX}
                disabled={disabled}
                onChange={(e) => onChange({ axisTitleX: e.target.value })}
              />
            </Field>
            <Field label="Tên trục dọc">
              <Input
                className="h-8 text-xs"
                value={style.axisTitleY}
                disabled={disabled}
                onChange={(e) => onChange({ axisTitleY: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Giá trị nhỏ nhất">
              <Input
                className="h-8 text-xs"
                type="number"
                value={style.yMin ?? ""}
                disabled={disabled}
                onChange={(e) => onChange({ yMin: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Giá trị lớn nhất">
              <Input
                className="h-8 text-xs"
                type="number"
                value={style.yMax ?? ""}
                disabled={disabled}
                onChange={(e) => onChange({ yMax: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
          </div>
        </div>
      )}

      {/* Riêng theo loại */}
      {(kind === "bar" || kind === "auto") && (
        <div className="space-y-2 border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">Biểu đồ cột</span>
          <Row label="Hướng">
            <Choice
              value={style.barOrientation}
              disabled={disabled}
              options={[
                { value: "vertical", label: "Dọc" },
                { value: "horizontal", label: "Ngang" },
              ]}
              onChange={(v) => onChange({ barOrientation: v })}
            />
          </Row>
          <Row label="Kiểu chồng">
            <Choice
              value={style.barStack}
              disabled={disabled}
              options={[
                { value: "none", label: "Cạnh nhau" },
                { value: "stacked", label: "Chồng" },
                { value: "percent", label: "Chồng 100%" },
              ]}
              onChange={(v) => onChange({ barStack: v })}
            />
          </Row>
          <NumSlider
            label="Bo góc thanh"
            value={style.barRadius}
            min={0}
            max={16}
            suffix="px"
            disabled={disabled}
            onCommit={(v) => onChange({ barRadius: v })}
          />
          <NumSlider
            label="Độ dày thanh"
            value={style.barSize ?? 0}
            min={0}
            max={80}
            suffix={style.barSize ? "px" : " (tự động)"}
            disabled={disabled}
            onCommit={(v) => onChange({ barSize: v === 0 ? null : v })}
          />
          <Row label="Nhãn giá trị trên thanh">
            <Switch checked={style.barLabels} disabled={disabled} onCheckedChange={(v) => onChange({ barLabels: v })} />
          </Row>
        </div>
      )}

      {(kind === "line" || kind === "area") && (
        <div className="space-y-2 border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">
            {kind === "line" ? "Biểu đồ đường" : "Biểu đồ vùng"}
          </span>
          <NumSlider
            label="Độ dày nét"
            value={style.lineWidth}
            min={1}
            max={6}
            suffix="px"
            disabled={disabled}
            onCommit={(v) => onChange({ lineWidth: v })}
          />
          <Row label="Dạng nét">
            <Choice
              value={style.lineCurve}
              disabled={disabled}
              options={[
                { value: "monotone", label: "Bo mềm" },
                { value: "linear", label: "Gãy khúc" },
                { value: "step", label: "Bậc thang" },
              ]}
              onChange={(v) => onChange({ lineCurve: v })}
            />
          </Row>
          <Row label="Nét đứt">
            <Switch checked={style.lineDashed} disabled={disabled} onCheckedChange={(v) => onChange({ lineDashed: v })} />
          </Row>
          <Row label="Hiện điểm nút">
            <Switch checked={style.lineDots} disabled={disabled} onCheckedChange={(v) => onChange({ lineDots: v })} />
          </Row>
          {kind === "area" && (
            <>
              <NumSlider
                label="Độ mờ nền"
                value={Math.round(style.areaOpacity * 100)}
                min={0}
                max={100}
                step={5}
                suffix="%"
                disabled={disabled}
                onCommit={(v) => onChange({ areaOpacity: v / 100 })}
              />
              <Row label="Chồng vùng">
                <Choice
                  value={style.barStack}
                  disabled={disabled}
                  options={[
                    { value: "none", label: "Không" },
                    { value: "stacked", label: "Chồng" },
                    { value: "percent", label: "Chồng 100%" },
                  ]}
                  onChange={(v) => onChange({ barStack: v })}
                />
              </Row>
            </>
          )}
        </div>
      )}

      {kind === "pie" && (
        <div className="space-y-2 border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">Biểu đồ tròn</span>
          <NumSlider
            label="Bán kính lỗ giữa"
            value={style.donutRatio}
            min={0}
            max={80}
            step={5}
            suffix="%"
            disabled={disabled}
            onCommit={(v) => onChange({ donutRatio: v })}
          />
          <NumSlider
            label="Khoảng cách lát"
            value={style.padAngle}
            min={0}
            max={10}
            disabled={disabled}
            onCommit={(v) => onChange({ padAngle: v })}
          />
          <Row label="Nhãn">
            <Choice
              value={style.pieLabels}
              disabled={disabled}
              options={[
                { value: "none", label: "Ẩn" },
                { value: "percent", label: "Phần trăm" },
                { value: "value", label: "Giá trị" },
              ]}
              onChange={(v) => onChange({ pieLabels: v })}
            />
          </Row>
          <Row label="Hiện tổng ở giữa">
            <Switch checked={style.pieTotal} disabled={disabled} onCheckedChange={(v) => onChange({ pieTotal: v })} />
          </Row>
        </div>
      )}

      {kind === "kpi" && (
        <div className="space-y-2 border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">Số KPI</span>
          <Field label="Nhãn thay thế">
            <Input
              className="h-8 text-xs"
              value={style.kpiLabel}
              disabled={disabled}
              onChange={(e) => onChange({ kpiLabel: e.target.value })}
            />
          </Field>
          <NumSlider
            label="Cỡ số"
            value={style.kpiSize}
            min={20}
            max={96}
            step={2}
            suffix="px"
            disabled={disabled}
            onCommit={(v) => onChange({ kpiSize: v })}
          />
          <Row label="Canh lề">
            <Choice
              value={style.kpiAlign}
              disabled={disabled}
              options={[
                { value: "left", label: "Trái" },
                { value: "center", label: "Giữa" },
              ]}
              onChange={(v) => onChange({ kpiAlign: v })}
            />
          </Row>
          <Field label="Màu số">
            <div className="flex gap-2">
              <input
                type="color"
                aria-label="Màu số KPI"
                value={style.kpiColor ?? theme.accent_color}
                disabled={disabled}
                onChange={(e) => onChange({ kpiColor: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
              />
              <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={disabled} onClick={() => onChange({ kpiColor: null })}>
                Theo chủ đề
              </Button>
            </div>
          </Field>
        </div>
      )}

      {kind === "table" && (
        <div className="space-y-2 border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">Bảng</span>
          <Row label="Kẻ sọc dòng">
            <Switch checked={style.tableStriped} disabled={disabled} onCheckedChange={(v) => onChange({ tableStriped: v })} />
          </Row>
          <Row label="Dòng gọn">
            <Switch checked={style.tableDense} disabled={disabled} onCheckedChange={(v) => onChange({ tableDense: v })} />
          </Row>
          <Row label="Thanh dữ liệu trong ô">
            <Switch checked={style.tableBars} disabled={disabled} onCheckedChange={(v) => onChange({ tableBars: v })} />
          </Row>
          {columns.length > 0 && (
            <Field label="Cột hiển thị">
              <div className="scroll-thin max-h-40 space-y-1 overflow-auto rounded-md border border-border p-2">
                {columns.map((c) => {
                  const checked = style.tableColumns === null || style.tableColumns.includes(c);
                  return (
                    <label key={c} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{c}</span>
                      <Switch
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(v) => {
                          const current = style.tableColumns ?? columns;
                          const next = v ? [...current, c] : current.filter((x) => x !== c);
                          onChange({ tableColumns: next.length === columns.length ? null : next });
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

export { DEFAULT_BLOCK_STYLE };
