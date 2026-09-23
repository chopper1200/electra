import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPatch } from "@/lib/api";
import type { Materiale } from "@/lib/types";
import { fmtNum, parseNum } from "@/lib/format";
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

interface StockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materiale: Materiale | null;
}

export default function StockModal({ open, onOpenChange, materiale }: StockModalProps) {
  const [quantita, setQuantita] = useState("");
  const [direzione, setDirezione] = useState<"carico" | "scarico">("carico");
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setQuantita("");
    setDirezione("carico");
  }, [open, materiale]);

  const adjust = useMutation({
    mutationFn: (delta: number) =>
      apiPatch<Materiale>(`/materiali/${materiale!.id}/stock`, { delta }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["materiali"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success("Giacenza aggiornata");
      onOpenChange(false);
    },
    onError: () => toast.error("Errore durante l'aggiornamento della giacenza"),
  });

  const submit = () => {
    if (!materiale) return;
    const q = parseNum(quantita);
    if (q <= 0) {
      toast.error("Inserisci una quantità maggiore di zero");
      return;
    }
    adjust.mutate(direzione === "carico" ? q : -q);
  };

  if (!materiale) return null;

  const nuovaGiacenza =
    direzione === "carico"
      ? materiale.quantita_disponibile + parseNum(quantita)
      : materiale.quantita_disponibile - parseNum(quantita);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="stock-modal"
        className="border-[#1E293B] bg-[#111827] sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-slate-100">Movimento di magazzino</DialogTitle>
          <DialogDescription className="text-slate-400">
            {materiale.nome} — giacenza attuale: {fmtNum(materiale.quantita_disponibile)}{" "}
            {materiale.unita_misura}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="stock-direzione">Operazione</Label>
            <Select value={direzione} onValueChange={(v) => setDirezione(v as "carico" | "scarico")}>
              <SelectTrigger id="stock-direzione" data-testid="stock-select-direzione" className="w-full">
                <SelectValue>{(v: string) => (v === "carico" ? "Carico (+)" : "Scarico (−)")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="carico" data-testid="stock-option-carico">
                  Carico (+)
                </SelectItem>
                <SelectItem value="scarico" data-testid="stock-option-scarico">
                  Scarico (−)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stock-quantita">Quantità ({materiale.unita_misura})</Label>
            <Input
              id="stock-quantita"
              data-testid="stock-input-quantita"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={quantita}
              onChange={(e) => setQuantita(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <p className="font-mono text-sm text-slate-400" data-testid="stock-preview">
          Nuova giacenza: {fmtNum(nuovaGiacenza)} {materiale.unita_misura}
        </p>

        <DialogFooter className="gap-2">
          <Button variant="outline" data-testid="btn-cancel-stock" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            data-testid="btn-save-stock"
            onClick={submit}
            disabled={adjust.isPending}
            className="bg-amber-500 text-black hover:bg-amber-600"
          >
            {adjust.isPending ? "Aggiorno…" : "Registra movimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
