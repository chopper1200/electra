import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Percent, TriangleAlert } from "lucide-react";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { Materiale } from "@/lib/types";
import { CATEGORIE, fmtEuro, parseNum } from "@/lib/format";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AppliciA = "vendita" | "costo" | "entrambi";

interface RisultatoRicarico {
  aggiornati: number;
  categoria: string;
  percentuale: number;
  applica_a: string;
  esempi: Materiale[];
}

const ETICHETTE_CAMPO: Record<AppliciA, string> = {
  vendita: "Solo prezzo di vendita",
  costo: "Solo prezzo di costo",
  entrambi: "Vendita e costo",
};

interface RicaricoPrezziModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RicaricoPrezziModal({ open, onOpenChange }: RicaricoPrezziModalProps) {
  const [categoria, setCategoria] = useState("tutte");
  const [percentuale, setPercentuale] = useState("5");
  const [applicaA, setApplicaA] = useState<AppliciA>("vendita");
  const [esito, setEsito] = useState<RisultatoRicarico | null>(null);
  const qc = useQueryClient();

  const { data: materiali } = useQuery({
    queryKey: ["materiali"],
    queryFn: () => apiGet<Materiale[]>("/materiali"),
    enabled: open,
  });

  const applica = useMutation({
    mutationFn: () =>
      apiPost<RisultatoRicarico>("/materiali/ricarico-prezzi", {
        categoria,
        percentuale: parseNum(percentuale),
        applica_a: applicaA,
        arrotonda: true,
      }),
    onSuccess: async (res) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["materiali"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setEsito(res);
      toast.success(
        `${res.aggiornati} articoli ricalcolati (${res.percentuale > 0 ? "+" : ""}${res.percentuale}%)`,
      );
    },
    onError: (e) => {
      const detail =
        e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body
          ? String((e.body as { detail: unknown }).detail)
          : "Ricalcolo non riuscito, riprova";
      toast.error(detail);
    },
  });

  const chiudi = (aperto: boolean) => {
    if (!aperto) {
      setEsito(null);
      setPercentuale("5");
      setCategoria("tutte");
      setApplicaA("vendita");
    }
    onOpenChange(aperto);
  };

  const pct = parseNum(percentuale);
  const interessati = (materiali ?? []).filter(
    (m) => categoria === "tutte" || m.categoria === categoria,
  );
  const anteprima = interessati.slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={chiudi}>
      <DialogContent
        data-testid="ricarico-modal"
        className="max-h-[90svh] overflow-y-auto border-[#27364F] bg-[#111827] sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-slate-100">Ricarico prezzi</DialogTitle>
          <DialogDescription className="text-slate-400">
            Quando il fornitore aggiorna il listino, applica il rincaro a un'intera categoria in
            un colpo. Percentuale negativa per applicare uno sconto.
          </DialogDescription>
        </DialogHeader>

        {!esito ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ric-categoria">Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger id="ric-categoria" data-testid="ricarico-select-categoria" className="w-full">
                    <SelectValue>
                      {(v: string) => (v === "tutte" ? "Tutte le categorie" : v)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="border-[#27364F] bg-[#162032]">
                    <SelectItem value="tutte" data-testid="ricarico-cat-tutte">
                      Tutte le categorie
                    </SelectItem>
                    {CATEGORIE.map((c) => (
                      <SelectItem key={c} value={c} data-testid={`ricarico-cat-${c.slice(0, 10)}`}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ric-percentuale">Variazione %</Label>
                <div className="relative">
                  <Input
                    id="ric-percentuale"
                    data-testid="ricarico-input-percentuale"
                    type="number"
                    step="0.5"
                    min="-90"
                    max="500"
                    value={percentuale}
                    onChange={(e) => setPercentuale(e.target.value)}
                    className="pr-9"
                  />
                  <Percent
                    size={14}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ric-applica">Applica a</Label>
                <Select value={applicaA} onValueChange={(v) => setApplicaA(v as AppliciA)}>
                  <SelectTrigger id="ric-applica" data-testid="ricarico-select-applica" className="w-full">
                    <SelectValue>{(v: string) => ETICHETTE_CAMPO[v as AppliciA]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="border-[#27364F] bg-[#162032]">
                    {(Object.keys(ETICHETTE_CAMPO) as AppliciA[]).map((k) => (
                      <SelectItem key={k} value={k} data-testid={`ricarico-applica-${k}`}>
                        {ETICHETTE_CAMPO[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border border-[#1E293B] bg-[#162032] p-3.5">
              <p className="flex items-center gap-2 text-sm font-medium text-slate-200">
                {pct >= 0 ? (
                  <ArrowUp size={15} className="text-amber-400" />
                ) : (
                  <ArrowDown size={15} className="text-emerald-400" />
                )}
                {interessati.length} articoli interessati
                <span className="ml-auto font-mono text-slate-400">
                  {pct > 0 ? "+" : ""}
                  {pct}%
                </span>
              </p>
              {anteprima.length > 0 && (
                <div className="mt-3 space-y-1.5" data-testid="ricarico-anteprima">
                  {anteprima.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 text-xs text-slate-400"
                    >
                      <span className="min-w-0 truncate">{m.nome}</span>
                      <span className="shrink-0 font-mono">
                        {fmtEuro(m.prezzo_unitario)} →{" "}
                        <span className="text-amber-400">
                          {fmtEuro(Math.round(m.prezzo_unitario * (1 + pct / 100) * 100) / 100)}
                        </span>
                      </span>
                    </div>
                  ))}
                  {interessati.length > anteprima.length && (
                    <p className="text-[11px] text-slate-500">
                      …e altri {interessati.length - anteprima.length} articoli
                    </p>
                  )}
                </div>
              )}
              <p className="mt-3 flex items-start gap-2 text-[11px] text-[#FBBF24]">
                <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                L'operazione modifica i prezzi salvati e non è annullabile: per tornare indietro
                applica la variazione inversa.
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-3" data-testid="ricarico-result">
            <p className="text-sm text-slate-300">
              <span
                className="font-mono text-2xl font-bold text-amber-400"
                data-testid="ricarico-count"
              >
                {esito.aggiornati}
              </span>{" "}
              articoli aggiornati ({esito.categoria === "tutte" ? "tutte le categorie" : esito.categoria},{" "}
              {esito.percentuale > 0 ? "+" : ""}
              {esito.percentuale}%, {ETICHETTE_CAMPO[esito.applica_a as AppliciA]?.toLowerCase()})
            </p>
            {esito.esempi.length > 0 && (
              <div className="space-y-1.5" data-testid="ricarico-esempi">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Nuovi prezzi
                </p>
                {esito.esempi.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#1E293B] bg-[#162032] px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-sm text-slate-100">{m.nome}</span>
                    <span className="shrink-0 font-mono text-xs text-amber-400">
                      {fmtEuro(m.prezzo_unitario)}/{m.unita_misura}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {esito ? (
            <Button
              data-testid="ricarico-done"
              onClick={() => chiudi(false)}
              className="bg-amber-500 text-black hover:bg-amber-600"
            >
              Fatto
            </Button>
          ) : (
            <>
              <Button variant="outline" data-testid="ricarico-cancel" onClick={() => chiudi(false)}>
                Annulla
              </Button>
              <Button
                data-testid="ricarico-apply"
                onClick={() => applica.mutate()}
                disabled={applica.isPending || pct === 0 || interessati.length === 0}
                className="bg-amber-500 text-black hover:bg-amber-600"
              >
                {applica.isPending ? "Applico…" : "Applica ricarico"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
