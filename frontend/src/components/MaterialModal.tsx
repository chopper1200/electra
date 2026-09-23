import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, apiPut } from "@/lib/api";
import type { Materiale, MaterialeInput, UnitaMisura } from "@/lib/types";
import { CATEGORIE, parseNum, UNITA_MISURA } from "@/lib/format";
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

interface FormState {
  nome: string;
  codice_art: string;
  categoria: string;
  unita_misura: UnitaMisura;
  prezzo_unitario: string;
  prezzo_costo: string;
  quantita_disponibile: string;
  scorta_minima: string;
  fornitore: string;
}

const EMPTY: FormState = {
  nome: "",
  codice_art: "",
  categoria: CATEGORIE[0],
  unita_misura: "pz",
  prezzo_unitario: "",
  prezzo_costo: "",
  quantita_disponibile: "",
  scorta_minima: "",
  fornitore: "",
};

interface MaterialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materiale: Materiale | null;
}

export default function MaterialModal({ open, onOpenChange, materiale }: MaterialModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setForm(
      materiale
        ? {
            nome: materiale.nome,
            codice_art: materiale.codice_art,
            categoria: materiale.categoria,
            unita_misura: materiale.unita_misura,
            prezzo_unitario: materiale.prezzo_unitario ? String(materiale.prezzo_unitario) : "",
            prezzo_costo: materiale.prezzo_costo ? String(materiale.prezzo_costo) : "",
            quantita_disponibile: String(materiale.quantita_disponibile ?? ""),
            scorta_minima: String(materiale.scorta_minima ?? ""),
            fornitore: materiale.fornitore,
          }
        : EMPTY,
    );
  }, [open, materiale]);

  const save = useMutation({
    mutationFn: (payload: MaterialeInput) =>
      materiale
        ? apiPut<Materiale>(`/materiali/${materiale.id}`, payload)
        : apiPost<Materiale>("/materiali", payload),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["materiali"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success(materiale ? "Materiale aggiornato" : "Materiale aggiunto al catalogo");
      onOpenChange(false);
    },
    onError: () => toast.error("Errore durante il salvataggio del materiale"),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.nome.trim()) {
      toast.error("Il nome del materiale è obbligatorio");
      return;
    }
    save.mutate({
      nome: form.nome.trim(),
      codice_art: form.codice_art,
      categoria: form.categoria,
      unita_misura: form.unita_misura,
      prezzo_unitario: parseNum(form.prezzo_unitario),
      prezzo_costo: parseNum(form.prezzo_costo),
      quantita_disponibile: parseNum(form.quantita_disponibile),
      scorta_minima: parseNum(form.scorta_minima),
      fornitore: form.fornitore,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="material-modal"
        className="max-h-[90svh] overflow-y-auto border-[#1E293B] bg-[#111827] sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-slate-100">
            {materiale ? "Modifica materiale" : "Nuovo materiale"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Articolo del catalogo con prezzi e giacenza di magazzino.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mat-nome">Nome *</Label>
            <Input
              id="mat-nome"
              data-testid="material-input-nome"
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Es. Cavo FS18 3G2,5"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mat-codice">Codice articolo</Label>
            <Input
              id="mat-codice"
              data-testid="material-input-codice"
              value={form.codice_art}
              onChange={(e) => set("codice_art", e.target.value)}
              placeholder="Es. FS18-3G25"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mat-categoria">Categoria</Label>
            <Select value={form.categoria} onValueChange={(v) => set("categoria", v)}>
              <SelectTrigger id="mat-categoria" data-testid="material-select-categoria" className="w-full">
                <SelectValue>{(v: string) => v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CATEGORIE.map((c) => (
                  <SelectItem key={c} value={c} data-testid={`material-option-${c.slice(0, 12)}`}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mat-unita">Unità di misura</Label>
            <Select
              value={form.unita_misura}
              onValueChange={(v) => set("unita_misura", v as UnitaMisura)}
            >
              <SelectTrigger id="mat-unita" data-testid="material-select-unita" className="w-full">
                <SelectValue>{(v: string) => v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {UNITA_MISURA.map((u) => (
                  <SelectItem key={u} value={u} data-testid={`material-unit-${u}`}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mat-prezzo">Prezzo di vendita (€)</Label>
            <Input
              id="mat-prezzo"
              data-testid="material-input-prezzo"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.prezzo_unitario}
              onChange={(e) => set("prezzo_unitario", e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mat-costo">Prezzo di costo (€)</Label>
            <Input
              id="mat-costo"
              data-testid="material-input-costo"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.prezzo_costo}
              onChange={(e) => set("prezzo_costo", e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mat-quantita">Quantità disponibile</Label>
            <Input
              id="mat-quantita"
              data-testid="material-input-quantita"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={form.quantita_disponibile}
              onChange={(e) => set("quantita_disponibile", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mat-scorta">Scorta minima</Label>
            <Input
              id="mat-scorta"
              data-testid="material-input-scorta"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.scorta_minima}
              onChange={(e) => set("scorta_minima", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mat-fornitore">Fornitore</Label>
            <Input
              id="mat-fornitore"
              data-testid="material-input-fornitore"
              value={form.fornitore}
              onChange={(e) => set("fornitore", e.target.value)}
              placeholder="Es. Gewiss, BTicino…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            data-testid="btn-cancel-material"
            onClick={() => onOpenChange(false)}
          >
            Annulla
          </Button>
          <Button
            data-testid="btn-save-material"
            onClick={submit}
            disabled={save.isPending}
            className="bg-amber-500 text-black hover:bg-amber-600"
          >
            {save.isPending ? "Salvo…" : materiale ? "Salva modifiche" : "Aggiungi materiale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
