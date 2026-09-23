import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, apiPost, apiPut } from "@/lib/api";
import type { Cliente, ClienteInput } from "@/lib/types";
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
import { Textarea } from "@/components/ui/textarea";

const EMPTY: ClienteInput = {
  nome: "",
  telefono: "",
  email: "",
  indirizzo: "",
  piva: "",
  note: "",
};

interface ClienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: Cliente | null;
}

export default function ClienteModal({ open, onOpenChange, cliente }: ClienteModalProps) {
  const [form, setForm] = useState<ClienteInput>(EMPTY);
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setForm(
      cliente
        ? {
            nome: cliente.nome,
            telefono: cliente.telefono,
            email: cliente.email,
            indirizzo: cliente.indirizzo,
            piva: cliente.piva,
            note: cliente.note,
          }
        : EMPTY,
    );
  }, [open, cliente]);

  const save = useMutation({
    mutationFn: (payload: ClienteInput) =>
      cliente
        ? apiPut<Cliente>(`/clienti/${cliente.id}`, payload)
        : apiPost<Cliente>("/clienti", payload),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["clienti"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success(cliente ? "Cliente aggiornato" : "Cliente salvato in anagrafica");
      onOpenChange(false);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        toast.error("Esiste già un cliente con questo nome");
      } else {
        toast.error("Errore durante il salvataggio del cliente");
      }
    },
  });

  const set = <K extends keyof ClienteInput>(k: K, v: ClienteInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.nome.trim()) {
      toast.error("Il nome del cliente è obbligatorio");
      return;
    }
    save.mutate({ ...form, nome: form.nome.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="cliente-modal"
        className="max-h-[90svh] overflow-y-auto border-[#27364F] bg-[#111827] sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-slate-100">
            {cliente ? "Modifica cliente" : "Nuovo cliente"}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            I clienti salvati qui si ricaricano con un click in lavori e preventivi.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cli-nome">Nome o ragione sociale *</Label>
            <Input
              id="cli-nome"
              data-testid="cliente-input-nome"
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Es. Marco Bianchi"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cli-telefono">Telefono</Label>
            <Input
              id="cli-telefono"
              data-testid="cliente-input-telefono"
              value={form.telefono}
              onChange={(e) => set("telefono", e.target.value)}
              inputMode="tel"
              placeholder="333 1234567"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cli-email">Email</Label>
            <Input
              id="cli-email"
              data-testid="cliente-input-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cli-indirizzo">Indirizzo</Label>
            <Input
              id="cli-indirizzo"
              data-testid="cliente-input-indirizzo"
              value={form.indirizzo}
              onChange={(e) => set("indirizzo", e.target.value)}
              placeholder="Via, numero, città"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cli-piva">P. IVA / Codice Fiscale</Label>
            <Input
              id="cli-piva"
              data-testid="cliente-input-piva"
              value={form.piva}
              onChange={(e) => set("piva", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cli-note">Note</Label>
            <Textarea
              id="cli-note"
              data-testid="cliente-textarea-note"
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              rows={2}
              placeholder="Citofono, orari, preferenze…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" data-testid="btn-cancel-cliente" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            data-testid="btn-save-cliente"
            onClick={submit}
            disabled={save.isPending}
            className="bg-amber-500 text-black hover:bg-amber-600"
          >
            {save.isPending ? "Salvo…" : cliente ? "Salva modifiche" : "Salva cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
