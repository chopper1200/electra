import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Lavoro } from "@/lib/types";
import { fmtDate, fmtEuro, fmtNum, parseNum } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lavoro: Lavoro | null;
}

export default function OreModal({ open, onOpenChange, lavoro }: OreModalProps) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [ore, setOre] = useState("");
  const [tariffa, setTariffa] = useState("35");
  const [descrizione, setDescrizione] = useState("");
  const qc = useQueryClient();

  // Dati sempre freschi dal cache: dopo una registrazione la lista si aggiorna da sola.
  const { data: lavoriFresh } = useQuery({
    queryKey: ["lavori"],
    queryFn: () => apiGet<Lavoro[]>("/lavori"),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setData(new Date().toISOString().slice(0, 10));
    setOre("");
    setTariffa("35");
    setDescrizione("");
  }, [open, lavoro]);

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["lavori"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const add = useMutation({
    mutationFn: (payload: {
      data: string;
      ore: number;
      tariffa_oraria: number;
      descrizione: string;
    }) => apiPost<Lavoro>(`/lavori/${lavoro!.id}/ore`, payload),
    onSuccess: async () => {
      await invalidate();
      toast.success("Ore registrate");
      setOre("");
      setDescrizione("");
    },
    onError: () => toast.error("Errore durante la registrazione delle ore"),
  });

  const remove = useMutation({
    mutationFn: (entryId: string) => apiDelete<Lavoro>(`/lavori/${lavoro!.id}/ore/${entryId}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Voce ore rimossa");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 400) {
        toast.error("Ora già inclusa in un preventivo: non può essere rimossa");
      } else {
        toast.error("Errore durante la rimozione della voce");
      }
    },
  });

  const submit = () => {
    if (!lavoro) return;
    const q = parseNum(ore);
    if (q <= 0) {
      toast.error("Inserisci le ore lavorate (maggiore di zero)");
      return;
    }
    add.mutate({
      data,
      ore: q,
      tariffa_oraria: parseNum(tariffa),
      descrizione: descrizione.trim(),
    });
  };

  if (!lavoro) return null;

  const corrente = lavoriFresh?.find((l) => l.id === lavoro.id) ?? lavoro;
  const voci = corrente.ore_lavorate ?? [];
  const totOre = voci.reduce((s, e) => s + e.ore, 0);
  const totValore = voci.reduce((s, e) => s + e.ore * e.tariffa_oraria, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="ore-modal"
        className="max-h-[90svh] overflow-y-auto border-slate-800 bg-[#0F172A] sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-slate-100">
            Registro ore — {corrente.titolo}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Traccia le ore lavorate in cantiere con la tariffa oraria: potrai importarle
            direttamente nei preventivi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2" data-testid="ore-list">
          {voci.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-400">
              Nessuna ora registrata per questo lavoro.
            </p>
          ) : (
            voci.map((e) => (
              <div
                key={e.id}
                data-testid={`ore-row-${e.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#1E293B] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {e.descrizione || "Manodopera"}
                  </p>
                  <p className="font-mono text-xs text-slate-400">
                    {fmtDate(e.data)} · {fmtNum(e.ore)} h × {fmtEuro(e.tariffa_oraria)}/h ={" "}
                    {fmtEuro(e.ore * e.tariffa_oraria)}
                  </p>
                </div>
                {e.preventivo_id ? (
                  <Badge
                    variant="outline"
                    data-testid={`ore-in-preventivo-${e.id}`}
                    className="shrink-0 border-sky-500/30 bg-[#0C4A6E] text-[#BAE6FD]"
                  >
                    In preventivo
                  </Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-testid={`ore-delete-${e.id}`}
                    aria-label="Rimuovi voce ore"
                    onClick={() => remove.mutate(e.id)}
                    className="shrink-0 text-slate-400 hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            ))
          )}
          {voci.length > 0 && (
            <p className="text-right font-mono text-sm text-amber-400" data-testid="ore-total">
              Totale: {fmtNum(totOre)} h · {fmtEuro(totValore)}
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-slate-800 bg-[#1E293B]/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Nuova voce
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ore-data">Data</Label>
              <Input
                id="ore-data"
                data-testid="ore-input-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ore-ore">Ore lavorate</Label>
              <Input
                id="ore-ore"
                data-testid="ore-input-ore"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={ore}
                onChange={(e) => setOre(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ore-tariffa">Tariffa (€/h)</Label>
              <Input
                id="ore-tariffa"
                data-testid="ore-input-tariffa"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={tariffa}
                onChange={(e) => setTariffa(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ore-descrizione">Descrizione</Label>
              <Input
                id="ore-descrizione"
                data-testid="ore-input-descrizione"
                value={descrizione}
                onChange={(e) => setDescrizione(e.target.value)}
                placeholder="Es. Cablaggio prese cucina"
              />
            </div>
          </div>
          <Button
            data-testid="ore-btn-add"
            onClick={submit}
            disabled={add.isPending}
            className="w-full bg-amber-500 text-black hover:bg-amber-600"
          >
            {add.isPending ? "Registro…" : "Registra ore"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
