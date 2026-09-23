import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Euro,
  FileSpreadsheet,
  Plus,
  Wrench,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { fmtDate, fmtEuro, fmtNum } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import JobModal from "@/components/JobModal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const [jobOpen, setJobOpen] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardStats>("/dashboard"),
  });

  const oggi = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const lavoriAttivi = (data?.ultimi_lavori ?? []).filter((l) => l.stato !== "completato");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-100">
            Dashboard
          </h1>
          <p className="text-sm capitalize text-slate-400">{oggi}</p>
        </div>
        <div className="flex gap-2">
          <Button
            data-testid="btn-create-job"
            onClick={() => setJobOpen(true)}
            className="min-h-11 bg-amber-500 text-black hover:bg-amber-600"
          >
            <Plus size={16} /> Nuovo lavoro
          </Button>
          <Link
            to="/preventivi/nuovo"
            data-testid="btn-create-quote"
            className={buttonVariants({ variant: "outline" })}
          >
            <FileSpreadsheet size={16} /> Nuovo preventivo
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-xl bg-[#0F172A]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            testId="kpi-active-jobs"
            label="Lavori in corso"
            value={String(data?.lavori_in_corso ?? 0)}
            icon={Wrench}
          />
          <StatCard
            testId="kpi-pending-quotes"
            label="Preventivi in attesa"
            value={String(data?.preventivi_in_attesa ?? 0)}
            icon={Clock}
          />
          <StatCard
            testId="kpi-low-stock"
            label="Sotto scorta"
            value={String(data?.materiali_sotto_scorta.length ?? 0)}
            icon={AlertTriangle}
            tone={data?.materiali_sotto_scorta.length ? "warning" : "default"}
          />
          <StatCard
            testId="kpi-revenue-projected"
            label="Da incassare"
            value={fmtEuro(data?.valore_preventivi_attesa ?? 0)}
            icon={Euro}
            tone="positive"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          data-testid="panel-lavori-attivi"
          className="border-slate-800/80 bg-[#0F172A] lg:col-span-3"
        >
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg text-slate-100">Lavori attivi</CardTitle>
            <Link
              to="/lavori"
              data-testid="dash-link-lavori"
              className="flex items-center gap-1 text-sm text-sky-400 hover:underline"
            >
              Vedi tutti <ArrowRight size={14} />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {isError ? (
              <p className="text-sm text-slate-400" data-testid="dash-lavori-error">
                Dati non disponibili al momento.
              </p>
            ) : lavoriAttivi.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-400">
                Nessun lavoro attivo. Creane uno con «Nuovo lavoro».
              </p>
            ) : (
              lavoriAttivi.map((l) => (
                <Link
                  key={l.id}
                  to="/lavori"
                  data-testid={`dash-lavoro-${l.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#1E293B] px-3 py-2.5 transition-colors hover:border-amber-500/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{l.titolo}</p>
                    <p className="truncate text-xs text-slate-400">
                      {l.cliente_nome}
                      {l.cliente_indirizzo ? ` — ${l.cliente_indirizzo}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden font-mono text-sm text-slate-300 sm:inline">
                      {fmtEuro(l.prezzo_pattuito)}
                    </span>
                    <StatusBadge kind="lavoro" stato={l.stato} />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card
            data-testid="panel-preventivi-recenti"
            className="border-slate-800/80 bg-[#0F172A]"
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-lg text-slate-100">
                Preventivi recenti
              </CardTitle>
              <Link
                to="/preventivi"
                data-testid="dash-link-preventivi"
                className="flex items-center gap-1 text-sm text-sky-400 hover:underline"
              >
                Vedi tutti <ArrowRight size={14} />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {isError ? (
                <p className="text-sm text-slate-400">Dati non disponibili al momento.</p>
              ) : (data?.preventivi_recenti ?? []).length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-400">
                  Nessun preventivo ancora.
                </p>
              ) : (
                (data?.preventivi_recenti ?? []).map((p) => (
                  <Link
                    key={p.id}
                    to={`/preventivi/${p.id}`}
                    data-testid={`dash-preventivo-${p.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#1E293B] px-3 py-2.5 transition-colors hover:border-amber-500/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-amber-400">{p.numero}</p>
                      <p className="truncate text-sm font-medium text-slate-100">
                        {p.cliente_nome}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-sm text-slate-300">
                        {fmtEuro(p.totale_preventivo)}
                      </span>
                      <StatusBadge kind="preventivo" stato={p.stato} />
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card
            data-testid="panel-sotto-scorta"
            className="border-slate-800/80 bg-[#0F172A]"
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-lg text-slate-100">Sotto scorta</CardTitle>
              <Link
                to="/materiali"
                data-testid="dash-link-materiali"
                className="flex items-center gap-1 text-sm text-sky-400 hover:underline"
              >
                Magazzino <ArrowRight size={14} />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {isError ? (
                <p className="text-sm text-slate-400">Dati non disponibili al momento.</p>
              ) : (data?.materiali_sotto_scorta ?? []).length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-slate-400">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  Magazzino ok: nessun articolo sotto scorta.
                </p>
              ) : (
                (data?.materiali_sotto_scorta ?? []).map((m) => (
                  <div
                    key={m.id}
                    data-testid={`dash-low-stock-${m.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-[#1E293B] px-3 py-2"
                  >
                    <p className="truncate text-sm font-medium text-slate-100">{m.nome}</p>
                    <p className="shrink-0 font-mono text-xs text-amber-400">
                      {fmtNum(m.quantita_disponibile)} {m.unita_misura} / min {fmtNum(m.scorta_minima)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-center text-xs text-slate-500">
        Fatturato completato: {fmtEuro(data?.fatturato_completato ?? 0)} · Valore magazzino:{" "}
        {fmtEuro(data?.valore_magazzino ?? 0)} · Dati aggiornati al {fmtDate(new Date().toISOString())}
      </p>

      <JobModal open={jobOpen} onOpenChange={setJobOpen} lavoro={null} />
    </div>
  );
}
