import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  testId: string;
  tone?: "default" | "warning" | "positive";
}

const TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-slate-100",
  warning: "text-amber-400",
  positive: "text-emerald-400",
};

export default function StatCard({ label, value, icon: Icon, testId, tone = "default" }: StatCardProps) {
  return (
    <Card
      data-testid={testId}
      className="border-slate-800/80 bg-[#0F172A] p-4 shadow-[0_0_15px_rgba(245,158,11,0.05)]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
          <Icon size={16} />
        </span>
      </div>
      <p className={`mt-2 font-mono text-2xl font-medium tracking-tight ${TONES[tone]}`}>{value}</p>
    </Card>
  );
}
