import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Euro,
  FileSpreadsheet,
  Hourglass,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Timer,
  UserRound,
  Wrench,
} from "lucide-react";
import { apiGet, apiPatch } from "@/lib/api";
import { fmtDate, fmtEuro, fmtNum, waLink } from "@/lib/format";
import type { DashboardStats, Preventivo } from "@/lib/types";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import JobModal from "@/components/JobModal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

function nomeMese(iso: string): string {
  const [, m] = iso.split("-");
  return MESI[Number(m) - 1] ?? iso;
}

export default function Dashboard() {
  const [jobOpen, setJobOpen] = useState(false);
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardStats>("/dashboard"),
  });

  const rinnova = useMutation({
    mutationFn: (id: string) =>
      apiPatch<Preventivo>(`/preventivi/${id}/rinnova`, { validita_giorni: 30 }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
        qc.invalidateQueries({ queryKey: ["preventivi"] }),
      ]);
      toast.success("Preventivo ri-emesso con validità di 30 giorni");
    },
    onError: () => toast.error("Errore durante il rinnovo del preventivo"),
  });

  const oggi = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const lavoriAttivi = (data?.ultimi_lavori ?? []).filter((l) => l.stato !== "completato");
  const scaduti = data?.preventivi_scaduti ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-amber-500/80">
            Centro di controllo
          </p>
          <h1 className="mt-1 font-heading text-[32px] font-bold leading-none tracking-tight text-slate-50 sm:text-4xl">
            Dashboard
          </h1>
          <p className="mt-2 text-sm capitalize text-slate-400">{oggi}</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[124px] animate-pulse rounded-2xl bg-[#111827]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            testId="kpi-active-jobs"
            label="Lavori in corso"
            value={String(data?.lavori_in_corso ?? 0)}
            icon={Wrench}
            hint={`${data?.lavori_da_iniziare ?? 0} da iniziare`}
          />
          <StatCard
            testId="kpi-pending-quotes"
            label="Preventivi in attesa"
            value={String(data?.preventivi_in_attesa ?? 0)}
            icon={Hourglass}
            tone="info"
            hint={fmtEuro(data?.valore_preventivi_attesa ?? 0)}
          />
          <StatCard
            testId="kpi-overdue-quotes"
            label="Scaduti da ricontattare"
            value={String(scaduti.length)}
            icon={Clock}
            tone={scaduti.length ? "danger" : "default"}
            hint={scaduti.length ? "Serve un follow-up" : "Tutto sotto controllo"}
          />
          <StatCard
            testId="kpi-low-stock"
            label="Sotto scorta"
            value={String(data?.materiali_sotto_scorta.length ?? 0)}
            icon={AlertTriangle}
            tone={data?.materiali_sotto_scorta.length ? "warning" : "default"}
            hint="Articoli da riordinare"
          />
        </div>
      )}

      {/* Riepilogo ore del mese */}
      <Card
        data-testid="panel-ore-mese"
        className="gap-0 overflow-hidden border-[#1E293B] bg-[#111827] p-0"
      >
        <div className="grid gap-0 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div className="border-b border-[#1E293B] bg-[#121E2C] p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-sky-400">
              <Timer size={14} /> Riepilogo ore
            </div>
            <p className="mt-1 text-sm capitalize text-slate-400" data-testid="ore-mese-label">
              {data ? `${nomeMese(data.mese_corrente)} ${data.mese_corrente.slice(0, 4)}` : "—"}
            </p>
            <div className="mt-4 flex items-end gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Ore</p>
                <p
                  className="font-mono text-[34px] font-bold leading-none text-sky-400"
                  data-testid="ore-mese-totale"
                >
                  {fmtNum(data?.ore_mese ?? 0)}
                  <span className="ml-1 text-base font-medium text-slate-500">h</span>
                </p>
              </div>
              <div className="border-l border-[#27364F] pl-4">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Valore</p>
                <p
                  className="font-mono text-[26px] font-bold leading-none text-emerald-400"
                  data-testid="ore-mese-valore"
                >
                  {fmtEuro(data?.valore_ore_mese ?? 0)}
                </p>
              </div>
            </div>
            {(data?.ore_mese ?? 0) > 0 && (
              <p className="mt-3 font-mono text-xs text-slate-500" data-testid="ore-mese-tariffa">
                Tariffa media {fmtEuro(data?.tariffa_media_mese ?? 0)}/h
              </p>
            )}
          </div>

          <div className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Ore per cantiere
            </p>
            <div className="mt-3 space-y-2" data-testid="ore-mese-lista">
              {(data?.ore_mese_per_lavoro ?? []).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#27364F] px-4 py-6 text-center text-sm text-slate-400">
                  Nessuna ora registrata questo mese. Apri un lavoro e usa «Registro ore».
                </p>
              ) : (
                (data?.ore_mese_per_lavoro ?? []).map((o) => {
                  const max = Math.max(...(data?.ore_mese_per_lavoro ?? []).map((x) => x.ore), 1);
                  return (
                    <div
                      key={o.lavoro_id}
                      data-testid={`ore-mese-riga-${o.lavoro_id}`}
                      className="rounded-xl border border-[#1E293B] bg-[#162032] px-3.5 py-2.5"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-medium text-slate-100">
                          {o.titolo}
                        </p>
                        <p className="shrink-0 font-mono text-sm text-slate-300">
                          {fmtNum(o.ore)} h · {fmtEuro(o.valore)}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="truncate text-xs text-slate-500">{o.cliente_nome}</span>
                        <span className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-[#0B0F17]">
                          <span
                            className="block h-full rounded-full bg-sky-500/70"
                            style={{ width: `${Math.round((o.ore / max) * 100)}%` }}
                          />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Promemoria scadenze */}
      {scaduti.length > 0 && (
        <Card
          data-testid="panel-scaduti"
          className="gap-0 border-red-500/25 bg-[#2A1418] p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 font-heading text-lg text-red-200">
              <Clock size={18} /> Preventivi scaduti senza risposta
            </CardTitle>
            <span className="font-mono text-sm text-red-300/80">
              {fmtEuro(scaduti.reduce((s, p) => s + p.totale_preventivo, 0))} in gioco
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {scaduti.map((p) => (
              <div
                key={p.id}
                data-testid={`scaduto-row-${p.id}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/20 bg-[#1E1014]/80 px-3.5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-amber-400">{p.numero}</span>
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-300">
                      scaduto da {Math.abs(p.giorni_alla_scadenza)} gg
                    </span>
                  </div>
                  <p className="truncate text-sm font-medium text-slate-100">{p.cliente_nome}</p>
                  <p className="truncate text-xs text-slate-400">
                    {p.titolo_intervento} · scadenza {fmtDate(p.data_scadenza)}
                  </p>
                </div>
                <span className="font-mono text-sm text-slate-100">
                  {fmtEuro(p.totale_preventivo)}
                </span>
                <div className="flex items-center gap-1">
                  {p.cliente_telefono && (
                    <>
                      <a
                        href={`tel:${p.cliente_telefono.replace(/\s/g, "")}`}
                        data-testid={`scaduto-call-${p.id}`}
                        aria-label="Chiama cliente"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-500/10 hover:text-sky-300"
                      >
                        <Phone size={15} />
                      </a>
                      <a
                        href={waLink(p.cliente_telefono)}
                        target="_blank"
                        rel="noreferrer"
                        data-testid={`scaduto-whatsapp-${p.id}`}
                        aria-label="Scrivi su WhatsApp"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-500/10 hover:text-emerald-300"
                      >
                        <MessageCircle size={15} />
                      </a>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`scaduto-renew-${p.id}`}
                    onClick={() => rinnova.mutate(p.id)}
                    disabled={rinnova.isPending}
                    className="border-red-500/30 text-red-100 hover:text-white"
                  >
                    <RefreshCw size={14} /> Rinnova 30 gg
                  </Button>
                  <Link
                    to={`/preventivi/${p.id}`}
                    data-testid={`scaduto-open-${p.id}`}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Apri
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          data-testid="panel-lavori-attivi"
          className="gap-0 border-[#1E293B] bg-[#111827] lg:col-span-3"
        >
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg text-slate-50">Lavori attivi</CardTitle>
            <Link
              to="/lavori"
              data-testid="dash-link-lavori"
              className="flex items-center gap-1 text-sm text-sky-400 transition-colors hover:text-sky-300"
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
              <p className="rounded-2xl border border-dashed border-[#27364F] px-4 py-6 text-center text-sm text-slate-400">
                Nessun lavoro attivo. Creane uno con «Nuovo lavoro».
              </p>
            ) : (
              lavoriAttivi.map((l) => (
                <Link
                  key={l.id}
                  to="/lavori"
                  data-testid={`dash-lavoro-${l.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#1E293B] bg-[#162032] px-3.5 py-3 transition-colors duration-150 hover:border-amber-500/40"
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
          <Card data-testid="panel-preventivi-recenti" className="gap-0 border-[#1E293B] bg-[#111827]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-lg text-slate-50">
                Preventivi recenti
              </CardTitle>
              <Link
                to="/preventivi"
                data-testid="dash-link-preventivi"
                className="flex items-center gap-1 text-sm text-sky-400 transition-colors hover:text-sky-300"
              >
                Vedi tutti <ArrowRight size={14} />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {isError ? (
                <p className="text-sm text-slate-400">Dati non disponibili al momento.</p>
              ) : (data?.preventivi_recenti ?? []).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#27364F] px-4 py-6 text-center text-sm text-slate-400">
                  Nessun preventivo ancora.
                </p>
              ) : (
                (data?.preventivi_recenti ?? []).map((p) => (
                  <Link
                    key={p.id}
                    to={`/preventivi/${p.id}`}
                    data-testid={`dash-preventivo-${p.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#1E293B] bg-[#162032] px-3.5 py-3 transition-colors duration-150 hover:border-amber-500/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-amber-400">{p.numero}</p>
                      <p className="truncate text-sm font-medium text-slate-100">
                        {p.cliente_nome}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-sm text-slate-300">
                        {fmtEuro(p.totale_preventivo)}
                      </span>
                      <StatusBadge kind="preventivo" stato={p.stato} scaduto={p.scaduto} />
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card data-testid="panel-sotto-scorta" className="gap-0 border-[#1E293B] bg-[#111827]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-lg text-slate-50">Sotto scorta</CardTitle>
              <Link
                to="/materiali"
                data-testid="dash-link-materiali"
                className="flex items-center gap-1 text-sm text-sky-400 transition-colors hover:text-sky-300"
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
                    className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-[#162032] px-3.5 py-2.5"
                  >
                    <p className="truncate text-sm font-medium text-slate-100">{m.nome}</p>
                    <p className="shrink-0 font-mono text-xs text-amber-400">
                      {fmtNum(m.quantita_disponibile)} {m.unita_misura} / min{" "}
                      {fmtNum(m.scorta_minima)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Euro size={12} /> Fatturato completato: {fmtEuro(data?.fatturato_completato ?? 0)}
        </span>
        <span>Valore magazzino: {fmtEuro(data?.valore_magazzino ?? 0)}</span>
        <Link
          to="/clienti"
          data-testid="dash-link-clienti"
          className="flex items-center gap-1.5 transition-colors hover:text-slate-300"
        >
          <UserRound size={12} /> {data?.clienti_totali ?? 0} clienti in anagrafica
        </Link>
      </div>

      <JobModal open={jobOpen} onOpenChange={setJobOpen} lavoro={null} />
    </div>
  );
}
