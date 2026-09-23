import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Lavoro, Materiale } from "@/lib/types";
import { fmtEuro, fmtNum, parseNum } from "@/lib/format";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RecordMaterialUsageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lavoro: Lavoro | null;
}

export default function RecordMaterialUsageModal({
  open,
  onOpenChange,
  lavoro,
}: RecordMaterialUsageModalProps) {
  const [materialeId, setMaterialeId] = useState("");
  const [quantita, setQuantita] = useState("");
  const qc = useQueryClient();

  const { data: materiali } = useQuery({
    queryKey: ["materiali"],
    queryFn: () => apiGet<Materiale[]>("/materiali"),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setMaterialeId("");
    setQuantita("");
  }, [open, lavoro]);

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["lavori"] }),
      qc.invalidateQueries({ queryKey: ["materiali"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const add = useMutation({
    mutationFn: (payload: { materiale_id: string; quantita: number }) =>
      apiPost<Lavoro>(`/lavori/${lavoro!.id}/materiali`, payload),
    onSuccess: async () => {
      await invalidate();
      toast.success("Materiale registrato: giacenza aggiornata");
      setMaterialeId("");
      setQuantita("");
    },
    onError: () => toast.error("Errore durante la registrazione del materiale"),
  });

  const remove = useMutation({
    mutationFn: (usageId: string) =>
      apiDelete<Lavoro>(`/lavori/${lavoro!.id}/materiali/${usageId}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Voce rimossa: giacenza ripristinata");
    },
    onError: () => toast.error("Errore durante la rimozione della voce"),
  });

  const submit = () => {
    if (!lavoro) return;
    const q = parseNum(quantita);
    if (!materialeId) {
      toast.error("Seleziona un materiale dal catalogo");
      return;
    }
    if (q <= 0) {
      toast.error("Inserisci una quantità maggiore di zero");
      return;
    }
    add.mutate({ materiale_id: materialeId, quantita: q });
  };

  if (!lavoro) return null;

  const selezionato = materiali?.find((m) => m.id === materialeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="usage-modal"
        className="max-h-[90svh] overflow-y-auto border-slate-800 bg-[#0F172A] sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-slate-100">
            Materiali usati — {lavoro.titolo}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Registra ciò che hai consumato in cantiere: la giacenza di magazzino si aggiorna da sola.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2" data-testid="usage-list">
          {(lavoro.materiali_usati ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-400">
              Nessun materiale registrato per questo lavoro.
            </p>
          ) : (
            lavoro.materiali_usati.map((u) => (
              <div
                key={u.id}
                data-testid={`usage-row-${u.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#1E293B] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{u.nome}</p>
                  <p className="font-mono text-xs text-slate-400">
                    {fmtNum(u.quantita)} {u.unita} × {fmtEuro(u.prezzo_unitario)} ={" "}
                    {fmtEuro(u.quantita * u.prezzo_unitario)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  data-testid={`usage-delete-${u.id}`}
                  aria-label="Rimuovi voce"
                  onClick={() => remove.mutate(u.id)}
                  className="text-slate-400 hover:text-red-400"
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-slate-800 bg-[#1E293B]/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Aggiungi dal catalogo
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="usage-materiale">Materiale</Label>
            <Select value={materialeId} onValueChange={setMaterialeId}>
              <SelectTrigger id="usage-materiale" data-testid="usage-select-material" className="w-full">
                <SelectValue>{(v: string) => materiali?.find((m) => m.id === v)?.nome ?? "Seleziona…"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(materiali ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id} data-testid={`usage-option-${m.id}`}>
                    {m.nome} ({fmtNum(m.quantita_disponibile)} {m.unita_misura})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="usage-quantita">
                Quantità {selezionato ? `(${selezionato.unita_misura})` : ""}
              </Label>
              <Input
                id="usage-quantita"
                data-testid="usage-input-quantita"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={quantita}
                onChange={(e) => setQuantita(e.target.value)}
                placeholder="0"
              />
            </div>
            <p className="pb-2 font-mono text-xs text-slate-400" data-testid="usage-price">
              {selezionato
                ? `${fmtEuro(selezionato.prezzo_unitario)}/${selezionato.unita_misura}`
                : "—"}
            </p>
          </div>
          <Button
            data-testid="usage-btn-add"
            onClick={submit}
            disabled={add.isPending}
            className="w-full bg-amber-500 text-black hover:bg-amber-600"
          >
            {add.isPending ? "Registro…" : "Registra materiale"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
