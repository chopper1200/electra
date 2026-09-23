import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  testId: string;
  hint?: string;
  tone?: "default" | "warning" | "positive" | "info" | "danger";
}

const VALUE_TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-slate-50",
  warning: "text-amber-400",
  positive: "text-emerald-400",
  info: "text-sky-400",
  danger: "text-red-400",
};

const CHIP_TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-[#162032] text-slate-300",
  warning: "bg-amber-500/10 text-amber-400",
  positive: "bg-emerald-500/10 text-emerald-400",
  info: "bg-sky-500/10 text-sky-400",
  danger: "bg-red-500/10 text-red-400",
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  testId,
  hint,
  tone = "default",
}: StatCardProps) {
  return (
    <Card
      data-testid={testId}
      className="group relative gap-0 overflow-hidden border-[#1E293B] bg-[#111827] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#334155]"
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          {label}
        </p>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${CHIP_TONES[tone]}`}
        >
          <Icon size={16} />
        </span>
      </div>
      <p
        className={`mt-3 font-mono text-[26px] font-bold leading-none tracking-tight ${VALUE_TONES[tone]}`}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}
