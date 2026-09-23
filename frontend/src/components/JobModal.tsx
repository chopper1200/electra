import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, apiPut } from "@/lib/api";
import type { Lavoro, LavoroInput, StatoLavoro } from "@/lib/types";
import { parseNum, STATO_LAVORO_LABELS } from "@/lib/format";
import ClientePicker from "@/components/ClientePicker";
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
import { Textarea } from "@/components/ui/textarea";

const STATI: StatoLavoro[] = ["da_iniziare", "in_corso", "completato"];

interface FormState {
  titolo: string;
  cliente_nome: string;
  cliente_telefono: string;
  cliente_indirizzo: string;
  descrizione: string;
  stato: StatoLavoro;
  data_inizio: string;
  data_fine_prevista: string;
  prezzo_pattuito: string;
  ore_manodopera: string;
  note: string;
}

const EMPTY: FormState = {
  titolo: "",
  cliente_nome: "",
  cliente_telefono: "",
  cliente_indirizzo: "",
  descrizione: "",
  stato: "da_iniziare",
  data_inizio: "",
  data_fine_prevista: "",
  prezzo_pattuito: "",
  ore_manodopera: "",
  note: "",
};

interface JobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lavoro: Lavoro | null;
}

export default function JobModal({ open, onOpenChange, lavoro }: JobModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setForm(
      lavoro
        ? {
            titolo: lavoro.titolo,
            cliente_nome: lavoro.cliente_nome,
            cliente_telefono: lavoro.cliente_telefono,
            cliente_indirizzo: lavoro.cliente_indirizzo,
            descrizione: lavoro.descrizione,
            stato: lavoro.stato,
            data_inizio: lavoro.data_inizio,
            data_fine_prevista: lavoro.data_fine_prevista,
            prezzo_pattuito: lavoro.prezzo_pattuito ? String(lavoro.prezzo_pattuito) : "",
            ore_manodopera: lavoro.ore_manodopera ? String(lavoro.ore_manodopera) : "",
            note: lavoro.note,
          }
        : EMPTY,
    );
  }, [open, lavoro]);

  const save = useMutation({
    mutationFn: (payload: LavoroInput) =>
      lavoro ? apiPut<Lavoro>(`/lavori/${lavoro.id}`, payload) : apiPost<Lavoro>("/lavori", payload),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["lavori"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success(lavoro ? "Lavoro aggiornato" : "Lavoro creato");
      onOpenChange(false);
    },
    onError: () => toast.error("Errore durante il salvataggio del lavoro"),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.titolo.trim() || !form.cliente_nome.trim()) {
      toast.error("Titolo e cliente sono obbligatori");
      return;
    }
    save.mutate({
      titolo: form.titolo.trim(),
      cliente_nome: form.cliente_nome.trim(),
      cliente_telefono: form.cliente_telefono,
      cliente_indirizzo: form.cliente_indirizzo,
      descrizione: form.descrizione,
      stato: form.stato,
      data_inizio: form.data_inizio,
      data_fine_prevista: form.data_fine_prevista,
      prezzo_pattuito: parseNum(form.prezzo_pattuito),
      ore_manodopera: parseNum(form.ore_manodopera),
      note: form.note,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="job-modal"
        className="max-h-[90svh] overflow-y-auto border-[#1E293B] bg-[#111827] sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-slate-100">
            {lavoro ? "Modifica lavoro" : "Nuovo lavoro"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Dati del cantiere, del cliente e dell'accordo economico.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ClientePicker
              testId="job-cliente-picker"
              onPick={(c) =>
                setForm((f) => ({
                  ...f,
                  cliente_nome: c.nome,
                  cliente_telefono: c.telefono || f.cliente_telefono,
                  cliente_indirizzo: c.indirizzo || f.cliente_indirizzo,
                }))
              }
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="job-titolo">Titolo *</Label>
            <Input
              id="job-titolo"
              data-testid="job-input-titolo"
              value={form.titolo}
              onChange={(e) => set("titolo", e.target.value)}
              placeholder="Es. Rifacimento impianto appartamento"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-cliente">Cliente *</Label>
            <Input
              id="job-cliente"
              data-testid="job-input-cliente"
              value={form.cliente_nome}
              onChange={(e) => set("cliente_nome", e.target.value)}
              placeholder="Nome e cognome o azienda"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-telefono">Telefono</Label>
            <Input
              id="job-telefono"
              data-testid="job-input-telefono"
              value={form.cliente_telefono}
              onChange={(e) => set("cliente_telefono", e.target.value)}
              placeholder="Es. 333 1234567"
              inputMode="tel"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="job-indirizzo">Indirizzo cantiere</Label>
            <Input
              id="job-indirizzo"
              data-testid="job-input-indirizzo"
              value={form.cliente_indirizzo}
              onChange={(e) => set("cliente_indirizzo", e.target.value)}
              placeholder="Via, numero, città"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="job-descrizione">Descrizione</Label>
            <Textarea
              id="job-descrizione"
              data-testid="job-textarea-descrizione"
              value={form.descrizione}
              onChange={(e) => set("descrizione", e.target.value)}
              placeholder="Interventi previsti, materiali, note tecniche…"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-stato">Stato</Label>
            <Select
              value={form.stato}
              onValueChange={(v) => set("stato", v as StatoLavoro)}
            >
              <SelectTrigger id="job-stato" data-testid="job-select-stato" className="w-full">
                <SelectValue>{(v: string) => STATO_LAVORO_LABELS[v as StatoLavoro]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATI.map((s) => (
                  <SelectItem key={s} value={s} data-testid={`job-option-${s}`}>
                    {STATO_LAVORO_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-data-inizio">Data inizio</Label>
            <Input
              id="job-data-inizio"
              data-testid="job-input-data-inizio"
              type="date"
              value={form.data_inizio}
              onChange={(e) => set("data_inizio", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-data-fine">Fine prevista</Label>
            <Input
              id="job-data-fine"
              data-testid="job-input-data-fine"
              type="date"
              value={form.data_fine_prevista}
              onChange={(e) => set("data_fine_prevista", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-prezzo">Prezzo pattuito (€)</Label>
            <Input
              id="job-prezzo"
              data-testid="job-input-prezzo"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.prezzo_pattuito}
              onChange={(e) => set("prezzo_pattuito", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-ore">Ore stimate</Label>
            <Input
              id="job-ore"
              data-testid="job-input-ore"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={form.ore_manodopera}
              onChange={(e) => set("ore_manodopera", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="job-note">Note</Label>
            <Textarea
              id="job-note"
              data-testid="job-textarea-note"
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Disponibilità del cliente, accordi, promemoria…"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            data-testid="btn-cancel-job"
            onClick={() => onOpenChange(false)}
          >
            Annulla
          </Button>
          <Button
            data-testid="btn-save-job"
            onClick={submit}
            disabled={save.isPending}
            className="bg-amber-500 text-black hover:bg-amber-600"
          >
            {save.isPending ? "Salvo…" : lavoro ? "Salva modifiche" : "Crea lavoro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
