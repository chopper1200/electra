import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Package, ShoppingCart, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Lavoro, ListaItem, ListaItemInput, ListaItemPatch, Materiale } from "@/lib/types";
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

interface ListaSpesaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lavoro: Lavoro | null;
}

const UNITA = ["pz", "m", "conf", "rotolo"];

export default function ListaSpesaModal({ open, onOpenChange, lavoro }: ListaSpesaModalProps) {
  const qc = useQueryClient();
  const [modo, setModo] = useState<"catalogo" | "libero">("catalogo");
  const [materialeId, setMaterialeId] = useState("");
  const [nome, setNome] = useState("");
  const [quantita, setQuantita] = useState("1");
  const [unita, setUnita] = useState("pz");
  const [prezzo, setPrezzo] = useState("");

  const { data: materiali } = useQuery({
    queryKey: ["materiali"],
    queryFn: () => apiGet<Materiale[]>("/materiali"),
    enabled: open,
  });

  const { data: lavoriFresh } = useQuery({
    queryKey: ["lavori"],
    queryFn: () => apiGet<Lavoro[]>("/lavori"),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setModo("catalogo");
    setMaterialeId("");
    setNome("");
    setQuantita("1");
    setUnita("pz");
    setPrezzo("");
  }, [open, lavoro]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["lavori"] });

  const add = useMutation({
    mutationFn: (payload: ListaItemInput) =>
      apiPost<Lavoro>(`/lavori/${lavoro!.id}/lista`, payload),
    onSuccess: async () => {
      await invalidate();
      toast.success("Aggiunto alla lista da comprare");
      setMaterialeId("");
      setNome("");
      setQuantita("1");
      setPrezzo("");
    },
    onError: () => toast.error("Errore durante l'aggiunta alla lista"),
  });

  const patch = useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: ListaItemPatch }) =>
      apiPatch<Lavoro>(`/lavori/${lavoro!.id}/lista/${itemId}`, body),
    onSuccess: invalidate,
    onError: () => toast.error("Errore durante la modifica della voce"),
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => apiDelete<Lavoro>(`/lavori/${lavoro!.id}/lista/${itemId}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Voce rimossa dalla lista");
    },
    onError: () => toast.error("Errore durante la rimozione della voce"),
  });

  if (!lavoro) return null;

  const corrente = lavoriFresh?.find((l) => l.id === lavoro.id) ?? lavoro;
  const lista: ListaItem[] = corrente.lista_spesa ?? [];
  const daComprare = lista.filter((i) => !i.comprato);
  const totaleStimato = daComprare.reduce((s, i) => s + i.quantita * i.prezzo_stimato, 0);
  const selezionato = materiali?.find((m) => m.id === materialeId);

  const giacenzaDi = (item: ListaItem): number | null => {
    if (!item.materiale_id) return null;
    const m = materiali?.find((x) => x.id === item.materiale_id);
    return m ? m.quantita_disponibile : null;
  };

  const submit = () => {
    const q = parseNum(quantita);
    if (q <= 0) {
      toast.error("Inserisci una quantità maggiore di zero");
      return;
    }
    if (modo === "catalogo" && !materialeId) {
      toast.error("Seleziona un materiale dal listino");
      return;
    }
    if (modo === "libero" && !nome.trim()) {
      toast.error("Scrivi cosa devi comprare");
      return;
    }
    add.mutate({
      materiale_id: modo === "catalogo" ? materialeId : "",
      nome: modo === "catalogo" ? "" : nome.trim(),
      quantita: q,
      unita: modo === "catalogo" ? (selezionato?.unita_misura ?? "pz") : unita,
      prezzo_stimato: parseNum(prezzo),
      note: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="lista-modal"
        className="max-h-[92svh] overflow-y-auto border-[#1E293B] bg-[#111827] sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-slate-100">
            Lista materiali da comprare — {corrente.titolo}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Quello che serve in cantiere: confronta con la giacenza, segna cosa hai comprato e
            importa la lista nel preventivo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1E293B] bg-[#162032] px-3 py-2">
          <span className="text-sm text-slate-400" data-testid="lista-count">
            {daComprare.length} da comprare · {lista.length - daComprare.length} comprati
          </span>
          <span className="font-mono text-sm text-amber-400" data-testid="lista-totale">
            Spesa stimata {fmtEuro(totaleStimato)}
          </span>
        </div>

        <div className="space-y-2" data-testid="lista-items">
          {lista.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#27364F] px-4 py-6 text-center text-sm text-slate-400">
              Lista vuota: aggiungi qui sotto il materiale che devi comprare per questo lavoro.
            </p>
          ) : (
            lista.map((i) => {
              const giacenza = giacenzaDi(i);
              const mancante = giacenza === null ? null : Math.max(0, i.quantita - giacenza);
              return (
                <div
                  key={i.id}
                  data-testid={`lista-row-${i.id}`}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                    i.comprato
                      ? "border-emerald-700/40 bg-emerald-500/5"
                      : "border-[#1E293B] bg-[#162032]"
                  }`}
                >
                  <button
                    data-testid={`lista-toggle-${i.id}`}
                    aria-label={i.comprato ? "Segna da comprare" : "Segna come comprato"}
                    onClick={() => patch.mutate({ itemId: i.id, body: { comprato: !i.comprato } })}
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      i.comprato
                        ? "border-emerald-500 bg-emerald-500 text-black"
                        : "border-[#27364F] text-slate-500 hover:border-amber-500 hover:text-amber-400"
                    }`}
                  >
                    <Check size={15} />
                  </button>
                  <div className="min-w-[8rem] flex-1">
                    <p
                      className={`truncate text-sm font-medium ${
                        i.comprato ? "text-slate-400 line-through" : "text-slate-100"
                      }`}
                      data-testid={`lista-nome-${i.id}`}
                    >
                      {i.nome}
                    </p>
                    <p className="font-mono text-xs text-slate-400">
                      {i.materiale_id ? (
                        <span data-testid={`lista-giacenza-${i.id}`}>
                          giacenza {fmtNum(giacenza ?? 0)} {i.unita}
                          {mancante && mancante > 0 ? (
                            <span className="ml-1 text-red-400">
                              · mancano {fmtNum(mancante)} {i.unita}
                            </span>
                          ) : (
                            <span className="ml-1 text-emerald-400">· già in magazzino</span>
                          )}
                        </span>
                      ) : (
                        <span data-testid={`lista-giacenza-${i.id}`}>voce libera</span>
                      )}
                    </p>
                  </div>
                  <Input
                    data-testid={`lista-qty-${i.id}`}
                    aria-label="Quantità"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={String(i.quantita)}
                    onBlur={(e) => {
                      const q = parseNum(e.target.value);
                      if (q > 0 && q !== i.quantita)
                        patch.mutate({ itemId: i.id, body: { quantita: q } });
                    }}
                    className="h-9 w-20 font-mono"
                  />
                  <Input
                    data-testid={`lista-price-${i.id}`}
                    aria-label="Prezzo stimato"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={String(i.prezzo_stimato)}
                    onBlur={(e) => {
                      const p = parseNum(e.target.value);
                      if (p !== i.prezzo_stimato)
                        patch.mutate({ itemId: i.id, body: { prezzo_stimato: p } });
                    }}
                    className="h-9 w-24 font-mono"
                  />
                  <span
                    className="w-20 text-right font-mono text-sm text-slate-300"
                    data-testid={`lista-subtotale-${i.id}`}
                  >
                    {fmtEuro(i.quantita * i.prezzo_stimato)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-testid={`lista-delete-${i.id}`}
                    aria-label="Rimuovi dalla lista"
                    onClick={() => remove.mutate(i.id)}
                    className="text-slate-400 hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-[#1E293B] bg-[#162032]/60 p-3">
          <div className="flex gap-2">
            <Button
              variant={modo === "catalogo" ? "default" : "outline"}
              size="sm"
              data-testid="lista-modo-catalogo"
              onClick={() => setModo("catalogo")}
              className={modo === "catalogo" ? "bg-amber-500 text-black hover:bg-amber-600" : ""}
            >
              <Package size={14} /> Dal listino
            </Button>
            <Button
              variant={modo === "libero" ? "default" : "outline"}
              size="sm"
              data-testid="lista-modo-libero"
              onClick={() => setModo("libero")}
              className={modo === "libero" ? "bg-amber-500 text-black hover:bg-amber-600" : ""}
            >
              <ShoppingCart size={14} /> Voce libera
            </Button>
          </div>

          {modo === "catalogo" ? (
            <div className="space-y-1.5">
              <Label htmlFor="lista-materiale">Materiale dal listino</Label>
              <Select
                value={materialeId}
                onValueChange={(v) => {
                  setMaterialeId(v);
                  const m = materiali?.find((x) => x.id === v);
                  if (m && !prezzo) setPrezzo(String(m.prezzo_costo || m.prezzo_unitario));
                }}
              >
                <SelectTrigger
                  id="lista-materiale"
                  data-testid="lista-select-material"
                  className="w-full"
                >
                  <SelectValue>
                    {(v: string) => materiali?.find((m) => m.id === v)?.nome ?? "Seleziona…"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="border-[#1E293B] bg-[#111827]">
                  {(materiali ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id} data-testid={`lista-option-${m.id}`}>
                      {m.nome} ({fmtNum(m.quantita_disponibile)} {m.unita_misura} in magazzino)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="lista-nome">Cosa devi comprare</Label>
                <Input
                  id="lista-nome"
                  data-testid="lista-input-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Es. Scatola derivazione 150x110"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lista-unita">Unità</Label>
                <Select value={unita} onValueChange={setUnita}>
                  <SelectTrigger id="lista-unita" data-testid="lista-select-unita" className="w-full">
                    <SelectValue>{(v: string) => v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="border-[#1E293B] bg-[#111827]">
                    {UNITA.map((u) => (
                      <SelectItem key={u} value={u} data-testid={`lista-unita-${u}`}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lista-quantita">
                Quantità {modo === "catalogo" && selezionato ? `(${selezionato.unita_misura})` : ""}
              </Label>
              <Input
                id="lista-quantita"
                data-testid="lista-input-quantita"
                type="number"
                min="0"
                step="0.01"
                value={quantita}
                onChange={(e) => setQuantita(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lista-prezzo">Prezzo stimato €</Label>
              <Input
                id="lista-prezzo"
                data-testid="lista-input-prezzo"
                type="number"
                min="0"
                step="0.01"
                value={prezzo}
                onChange={(e) => setPrezzo(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <Button
            data-testid="lista-btn-add"
            onClick={submit}
            disabled={add.isPending}
            className="w-full bg-amber-500 text-black hover:bg-amber-600"
          >
            {add.isPending ? "Aggiungo…" : "Aggiungi alla lista"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
