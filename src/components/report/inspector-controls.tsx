import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

/** Nhãn + control nằm ngang, dùng trong panel Inspector/AdhocChartBuilder. */
export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** Nhãn + control xếp dọc. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** Select wrapper gọn cho lựa chọn dạng chuỗi cố định. */
export function Choice<T extends string>({
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
    <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled ?? false}>
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

/** Slider số có nhãn hiển thị giá trị hiện tại, commit khi thả tay. */
export function NumSlider({
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
        disabled={disabled ?? false}
        onValueCommit={([v]) => onCommit(v ?? value)}
      />
    </div>
  );
}
