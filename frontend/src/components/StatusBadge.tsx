import { cn } from "@/lib/utils";
import { STATO_LAVORO_LABELS, STATO_PREVENTIVO_LABELS } from "@/lib/format";
import type { StatoLavoro, StatoPreventivo } from "@/lib/types";

const LAVORO_STYLES: Record<StatoLavoro, string> = {
  da_iniziare: "border border-slate-600/40 bg-[#162032] text-slate-300",
  in_corso: "border border-amber-500/30 bg-[#3D2708] text-[#FBBF24]",
  completato: "border border-emerald-500/30 bg-[#064E3B] text-[#34D399]",
};

const PREVENTIVO_STYLES: Record<StatoPreventivo, string> = {
  bozza: "border border-slate-500/40 bg-[#162032] text-slate-200",
  inviato: "border border-sky-500/30 bg-[#0C3656] text-[#60A5FA]",
  accettato: "border border-emerald-500/30 bg-[#064E3B] text-[#34D399]",
  rifiutato: "border border-red-500/30 bg-[#451419] text-[#F87171]",
};

interface StatusBadgeProps {
  kind: "lavoro" | "preventivo";
  stato: string;
  /** Solo per i preventivi: sostituisce l'etichetta con «Scaduto» in rosso. */
  scaduto?: boolean;
  className?: string;
}

export default function StatusBadge({ kind, stato, scaduto, className }: StatusBadgeProps) {
  if (kind === "preventivo" && scaduto) {
    return (
      <span
        data-testid="badge-preventivo-scaduto"
        className={cn(
          "inline-flex items-center whitespace-nowrap rounded-full border border-red-500/40 bg-[#451419] px-2.5 py-0.5 text-xs font-medium text-[#F87171]",
          className,
        )}
      >
        Scaduto
      </span>
    );
  }

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
