import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, PackagePlus, Search, Undo2 } from "lucide-react";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { Materiale } from "@/lib/types";
import { fmtEuro, fmtNum, parseNum } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RisultatoCarico {
  aggiornati: number;
  pezzi_totali: number;
  valore_carico: number;
  materiali: Materiale[];
}

interface CaricoRapidoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CaricoRapidoModal({ open, onOpenChange }: CaricoRapidoModalProps) {
  const [search, setSearch] = useState("");
  const [soloSottoScorta, setSoloSottoScorta] = useState(false);
  const [quantita, setQuantita] = useState<Record<string, string>>({});
  const [esito, setEsito] = useState<RisultatoCarico | null>(null);
  const qc = useQueryClient();

  const { data: materiali } = useQuery({
    queryKey: ["materiali"],
    queryFn: () => apiGet<Materiale[]>("/materiali"),
    enabled: open,
  });

  const carica = useMutation({
    mutationFn: (righe: { materiale_id: string; quantita: number }[]) =>
      apiPost<RisultatoCarico>("/materiali/carico-multiplo", { righe }),
    onSuccess: async (res) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["materiali"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setEsito(res);
      setQuantita({});
      toast.success(`Magazzino aggiornato: ${res.aggiornati} articoli caricati`);
    },
    onError: (e) => {
      const detail =
        e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body
          ? String((e.body as { detail: unknown }).detail)
          : "Carico non riuscito, riprova";
      toast.error(detail);
    },
  });

  const chiudi = (aperto: boolean) => {
    if (!aperto) {
      setEsito(null);
      setQuantita({});
      setSearch("");
      setSoloSottoScorta(false);
    }
    onOpenChange(aperto);
  };

  const q = search.trim().toLowerCase();
  const elenco = (materiali ?? []).filter(
    (m) =>
      (!soloSottoScorta || m.quantita_disponibile <= m.scorta_minima) &&
      (m.nome.toLowerCase().includes(q) || m.codice_art.toLowerCase().includes(q)),
  );

  const righeCompilate = useMemo(
    () =>
      Object.entries(quantita)
        .map(([materiale_id, v]) => ({ materiale_id, quantita: parseNum(v) }))
        .filter((r) => r.quantita !== 0),
    [quantita],
  );

  const valoreStimato = righeCompilate.reduce((s, r) => {
    const m = materiali?.find((x) => x.id === r.materiale_id);
    return s + r.quantita * (m?.prezzo_costo ?? 0);
  }, 0);

  const suggerisciMancanti = () => {
    const sotto = (materiali ?? []).filter((m) => m.quantita_disponibile <= m.scorta_minima);
    if (sotto.length === 0) {
      toast.info("Nessun articolo sotto scorta: magazzino a posto");
      return;
    }
    setQuantita((prev) => {
      const next = { ...prev };
      for (const m of sotto) {
        const mancante = Math.max(m.scorta_minima - m.quantita_disponibile, 0);
        next[m.id] = String(mancante > 0 ? mancante : m.scorta_minima || 1);
      }
      return next;
    });
    setSoloSottoScorta(true);
    toast.success(`Precompilate le quantità per ${sotto.length} articoli sotto scorta`);
  };

  return (
    <Dialog open={open} onOpenChange={chiudi}>
      <DialogContent
        data-testid="carico-modal"
        className="flex max-h-[90svh] flex-col overflow-hidden border-[#27364F] bg-[#111827] sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-slate-100">Carico rapido</DialogTitle>
          <DialogDescription className="text-slate-400">
            Segna cosa hai comprato dal fornitore: inserisci le quantità e aggiorno tutte le
            giacenze in un colpo.
          </DialogDescription>
        </DialogHeader>

        {esito ? (
          <div className="space-y-3" data-testid="carico-result">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Articoli", value: String(esito.aggiornati), testId: "carico-count", tone: "text-emerald-400" },
                { label: "Quantità", value: fmtNum(esito.pezzi_totali), testId: "carico-pezzi", tone: "text-sky-400" },
                { label: "Spesa stimata", value: fmtEuro(esito.valore_carico), testId: "carico-valore", tone: "text-amber-400" },
              ].map((c) => (
                <div
                  key={c.label}
                  data-testid={c.testId}
                  className="rounded-xl border border-[#1E293B] bg-[#162032] p-3 text-center"
                >
                  <p className={`font-mono text-xl font-bold ${c.tone}`}>{c.value}</p>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">{c.label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Nuove giacenze
              </p>
              {esito.materiali.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#1E293B] bg-[#162032] px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm text-slate-100">{m.nome}</span>
                  <span className="shrink-0 font-mono text-xs text-emerald-400">
                    {fmtNum(m.quantita_disponibile)} {m.unita_misura}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px] flex-1 space-y-1.5">
                <Label htmlFor="carico-search">Cerca</Label>
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <Input
                    id="carico-search"
                    data-testid="carico-search-input"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nome o codice…"
                    className="pl-9"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                data-testid="carico-filter-sottoscorta"
                onClick={() => setSoloSottoScorta((v) => !v)}
                className={soloSottoScorta ? "border-amber-500/60 text-amber-300" : ""}
              >
                <AlertTriangle size={15} /> Sotto scorta
              </Button>
              <Button variant="outline" data-testid="carico-suggerisci" onClick={suggerisciMancanti}>
                <PackagePlus size={15} /> Riempi mancanti
              </Button>
            </div>

            <div className="-mx-1 mt-1 flex-1 space-y-1.5 overflow-y-auto px-1" data-testid="carico-lista">
              {elenco.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#27364F] px-4 py-8 text-center text-sm text-slate-400">
                  {materiali?.length
                    ? "Nessun articolo con questi filtri."
                    : "Catalogo vuoto: importa prima il listino del fornitore."}
                </p>
              ) : (
                elenco.map((m) => {
                  const basso = m.quantita_disponibile <= m.scorta_minima;
                  const val = quantita[m.id] ?? "";
                  const nuova = m.quantita_disponibile + parseNum(val);
                  return (
                    <div
                      key={m.id}
                      data-testid={`carico-row-${m.id}`}
                      className="flex items-center gap-3 rounded-lg border border-[#1E293B] bg-[#162032] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">{m.nome}</p>
                        <p className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                          {fmtNum(m.quantita_disponibile)} {m.unita_misura}
                          {basso && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 bg-[#3D2708] px-1.5 py-0 text-[10px] text-[#FBBF24]"
                            >
                              min {fmtNum(m.scorta_minima)}
                            </Badge>
                          )}
                          {m.prezzo_costo > 0 && <span>· costo {fmtEuro(m.prezzo_costo)}</span>}
                        </p>
                      </div>
                      {parseNum(val) !== 0 && (
                        <span className="shrink-0 font-mono text-xs text-emerald-400">
                          → {fmtNum(nuova)}
                        </span>
                      )}
                      <Input
                        data-testid={`carico-input-${m.id}`}
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        value={val}
                        onChange={(e) =>
                          setQuantita((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                        placeholder="0"
                        aria-label={`Quantità caricata per ${m.nome}`}
                        className="w-24 shrink-0 text-right"
                      />
                    </div>
                  );
                })
              )}
            </div>

            {righeCompilate.length > 0 && (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border border-[#1E293B] bg-[#162032] px-3.5 py-2.5"
                data-testid="carico-riepilogo"
              >
                <span className="text-sm text-slate-300">
                  {righeCompilate.length} articoli da caricare
                </span>
                <span className="font-mono text-sm text-amber-400">
                  spesa stimata {fmtEuro(valoreStimato)}
                </span>
              </div>
            )}
          </>
        )}

        <DialogFooter className="gap-2">
          {esito ? (
            <Button
              data-testid="carico-done"
              onClick={() => chiudi(false)}
              className="bg-amber-500 text-black hover:bg-amber-600"
            >
              Fatto
            </Button>
          ) : (
            <>
              {righeCompilate.length > 0 && (
                <Button variant="ghost" data-testid="carico-reset" onClick={() => setQuantita({})}>
                  <Undo2 size={15} /> Azzera
                </Button>
              )}
              <Button variant="outline" data-testid="carico-cancel" onClick={() => chiudi(false)}>
                Annulla
              </Button>
              <Button
                data-testid="carico-apply"
                onClick={() => carica.mutate(righeCompilate)}
                disabled={carica.isPending || righeCompilate.length === 0}
                className="bg-amber-500 text-black hover:bg-amber-600"
              >
                {carica.isPending ? "Aggiorno…" : "Aggiorna giacenze"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
