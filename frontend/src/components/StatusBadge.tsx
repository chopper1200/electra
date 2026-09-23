import { cn } from "@/lib/utils";
import {
  STATO_LAVORO_LABELS,
  STATO_PREVENTIVO_LABELS,
} from "@/lib/format";
import type { StatoLavoro, StatoPreventivo } from "@/lib/types";

const LAVORO_STYLES: Record<StatoLavoro, string> = {
  da_iniziare: "border border-slate-600/50 bg-slate-700/50 text-slate-300",
  in_corso: "border border-amber-500/30 bg-[#451A03] text-[#FDE68A]",
  completato: "border border-emerald-500/30 bg-[#064E3B] text-[#A7F3D0]",
};

const PREVENTIVO_STYLES: Record<StatoPreventivo, string> = {
  bozza: "border border-slate-500/40 bg-slate-600/50 text-slate-100",
  inviato: "border border-sky-500/30 bg-[#0C4A6E] text-[#BAE6FD]",
  accettato: "border border-emerald-500/30 bg-[#064E3B] text-[#A7F3D0]",
  rifiutato: "border border-red-500/30 bg-[#450A0A] text-[#FECACA]",
};

interface StatusBadgeProps {
  kind: "lavoro" | "preventivo";
  stato: string;
  className?: string;
}

export default function StatusBadge({ kind, stato, className }: StatusBadgeProps) {
  const label =
    kind === "lavoro"
      ? STATO_LAVORO_LABELS[stato as StatoLavoro] ?? stato
      : STATO_PREVENTIVO_LABELS[stato as StatoPreventivo] ?? stato;
  const style =
    kind === "lavoro"
      ? LAVORO_STYLES[stato as StatoLavoro] ?? LAVORO_STYLES.da_iniziare
      : PREVENTIVO_STYLES[stato as StatoPreventivo] ?? PREVENTIVO_STYLES.bozza;
  return (
    <span
      data-testid={`badge-${kind}-${stato}`}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        style,
        className,
      )}
    >
      {label}
    </span>
  );
}
