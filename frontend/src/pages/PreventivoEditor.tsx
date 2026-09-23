import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { Materiale, Preventivo, PreventivoInput } from "@/lib/types";
import { fmtEuro, parseNum } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

interface MatRow {
  materiale_id: string;
  nome: string;
  unita: string;
  prezzo_unitario: string;
  quantita: string;
}

interface ManRow {
  descrizione: string;
  ore: string;
  tariffa_oraria: string;
}

interface FormState {
  cliente_nome: string;
  cliente_telefono: string;
  cliente_email: string;
  cliente_indirizzo: string;
  cliente_piva: string;
  titolo_intervento: string;
  data_emissione: string;
  validita_giorni: string;
  matRows: MatRow[];
  manRows: ManRow[];
  sconto: string;
  aliquota: string;
  note_condizioni: string;
}

const NOTE_DEFAULT =
  "Pagamento a saldo entro 30 giorni dalla data di emissione. Garanzia di legge sui prodotti e 12 mesi su manodopera.";

const emptyForm = (): FormState => ({
  cliente_nome: "",
  cliente_telefono: "",
  cliente_email: "",
  cliente_indirizzo: "",
  cliente_piva: "",
  titolo_intervento: "",
  data_emissione: new Date().toISOString().slice(0, 10),
  validita_giorni: "30",
  matRows: [],
  manRows: [{ descrizione: "", ore: "", tariffa_oraria: "35" }],
  sconto: "",
  aliquota: "22",
  note_condizioni: NOTE_DEFAULT,
});

export default function PreventivoEditor() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [initialized, setInitialized] = useState(false);

  const { data: materiali } = useQuery({
    queryKey: ["materiali"],
    queryFn: () => apiGet<Materiale[]>("/materiali"),
  });

  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ["preventivo", id],
    queryFn: () => apiGet<Preventivo>(`/preventivi/${id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (initialized || !isEdit || !quote) return;
    setForm({
      cliente_nome: quote.cliente_nome,
      cliente_telefono: quote.cliente_telefono,
      cliente_email: quote.cliente_email,
      cliente_indirizzo: quote.cliente_indirizzo,
      cliente_piva: quote.cliente_piva,
      titolo_intervento: quote.titolo_intervento,
      data_emissione: quote.data_emissione,
      validita_giorni: String(quote.validita_giorni),
      matRows: quote.voci_materiali.map((v) => ({
        materiale_id: v.materiale_id,
        nome: v.nome,
        unita: v.unita,
        prezzo_unitario: String(v.prezzo_unitario),
        quantita: String(v.quantita),
      })),
      manRows: quote.voci_manodopera.map((v) => ({
        descrizione: v.descrizione,
        ore: String(v.ore),
        tariffa_oraria: String(v.tariffa_oraria),
      })),
      sconto: quote.sconto_percentuale ? String(quote.sconto_percentuale) : "",
      aliquota: String(quote.aliquota_iva),
      note_condizioni: quote.note_condizioni,
    });
    setInitialized(true);
  }, [initialized, isEdit, quote]);

  const subMat = form.matRows.reduce(
    (s, r) => s + parseNum(r.quantita) * parseNum(r.prezzo_unitario),
    0,
  );
  const subMan = form.manRows.reduce(
    (s, r) => s + parseNum(r.ore) * parseNum(r.tariffa_oraria),
    0,
  );
  const lordo = subMat + subMan;
  const scontoImp = (lordo * parseNum(form.sconto)) / 100;
  const imponibile = lordo - scontoImp;
  const iva = (imponibile * parseNum(form.aliquota)) / 100;
  const totale = imponibile + iva;

  const save = useMutation({
    mutationFn: (payload: PreventivoInput) =>
      isEdit
        ? apiPut<Preventivo>(`/preventivi/${id}`, payload)
        : apiPost<Preventivo>("/preventivi", payload),
    onSuccess: async (saved) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["preventivi"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
        qc.invalidateQueries({ queryKey: ["preventivo", saved.id] }),
      ]);
      toast.success(isEdit ? "Preventivo aggiornato" : "Preventivo creato");
      navigate(`/preventivi/${saved.id}`);
    },
    onError: () => toast.error("Errore durante il salvataggio del preventivo"),
  });

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const setMat = (idx: number, patch: Partial<MatRow>) =>
    setForm((f) => ({
      ...f,
      matRows: f.matRows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));

  const addMat = () =>
    setForm((f) => ({
      ...f,
      matRows: [...f.matRows, { materiale_id: "", nome: "", unita: "pz", prezzo_unitario: "", quantita: "" }],
    }));

  const removeMat = (idx: number) =>
    setForm((f) => ({ ...f, matRows: f.matRows.filter((_, i) => i !== idx) }));

  const setMan = (idx: number, patch: Partial<ManRow>) =>
    setForm((f) => ({
      ...f,
      manRows: f.manRows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));

  const addMan = () =>
    setForm((f) => ({
      ...f,
      manRows: [...f.manRows, { descrizione: "", ore: "", tariffa_oraria: "35" }],
    }));

  const removeMan = (idx: number) =>
    setForm((f) => ({ ...f, manRows: f.manRows.filter((_, i) => i !== idx) }));

  const onMaterialPick = (idx: number, materialeId: string) => {
    const m = materiali?.find((x) => x.id === materialeId);
    setMat(idx, {
      materiale_id: materialeId,
      nome: m?.nome ?? "",
      unita: m?.unita_misura ?? "pz",
      prezzo_unitario: m ? String(m.prezzo_unitario) : "",
    });
  };

  const submit = () => {
    if (!form.cliente_nome.trim() || !form.titolo_intervento.trim()) {
      toast.error("Cliente e titolo dell'intervento sono obbligatori");
      return;
    }
    if (
      !form.matRows.some((r) => r.materiale_id) &&
      !form.manRows.some((r) => r.descrizione.trim())
    ) {
      toast.error("Aggiungi almeno una voce di materiale o manodopera");
      return;
    }
    save.mutate({
      cliente_nome: form.cliente_nome.trim(),
      cliente_telefono: form.cliente_telefono,
      cliente_email: form.cliente_email,
      cliente_indirizzo: form.cliente_indirizzo,
      cliente_piva: form.cliente_piva,
      titolo_intervento: form.titolo_intervento.trim(),
      data_emissione: form.data_emissione,
      validita_giorni: Number(form.validita_giorni) || 30,
      voci_materiali: form.matRows
        .filter((r) => r.materiale_id)
        .map((r) => ({
          materiale_id: r.materiale_id,
          nome: r.nome,
          quantita: parseNum(r.quantita),
          unita: r.unita,
          prezzo_unitario: parseNum(r.prezzo_unitario),
        })),
      voci_manodopera: form.manRows
        .filter((r) => r.descrizione.trim())
        .map((r) => ({
          descrizione: r.descrizione.trim(),
          ore: parseNum(r.ore),
          tariffa_oraria: parseNum(r.tariffa_oraria),
        })),
      sconto_percentuale: parseNum(form.sconto),
      aliquota_iva: parseNum(form.aliquota) || 22,
      note_condizioni: form.note_condizioni,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            to="/preventivi"
            data-testid="editor-back-link"
            aria-label="Torna ai preventivi"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-100">
              {isEdit ? "Modifica preventivo" : "Nuovo preventivo"}
            </h1>
            <p className="font-mono text-sm text-amber-400">{quote?.numero ?? "—"}</p>
          </div>
        </div>
        <Button
          data-testid="btn-save-quote"
          onClick={submit}
          disabled={save.isPending}
          className="min-h-11 bg-amber-500 text-black hover:bg-amber-600"
        >
          {save.isPending ? "Salvo…" : "Salva preventivo"}
        </Button>
      </div>

      {isEdit && quoteLoading && !initialized ? (
        <div className="h-96 animate-pulse rounded-xl bg-[#0F172A]" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card data-testid="editor-cliente" className="border-slate-800/80 bg-[#0F172A] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Cliente e intervento
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="q-cliente">Nome cliente *</Label>
                  <Input
                    id="q-cliente"
                    data-testid="quote-input-cliente"
                    value={form.cliente_nome}
                    onChange={(e) => set("cliente_nome", e.target.value)}
                    placeholder="Nome e cognome o azienda"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q-titolo">Titolo intervento *</Label>
                  <Input
                    id="q-titolo"
                    data-testid="quote-input-titolo"
                    value={form.titolo_intervento}
                    onChange={(e) => set("titolo_intervento", e.target.value)}
                    placeholder="Es. Rifacimento impianto bagno"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q-telefono">Telefono</Label>
                  <Input
                    id="q-telefono"
                    data-testid="quote-input-telefono"
                    value={form.cliente_telefono}
                    onChange={(e) => set("cliente_telefono", e.target.value)}
                    inputMode="tel"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="q-indirizzo">Indirizzo</Label>
                  <Input
                    id="q-indirizzo"
                    data-testid="quote-input-indirizzo"
                    value={form.cliente_indirizzo}
                    onChange={(e) => set("cliente_indirizzo", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q-email">Email</Label>
                  <Input
                    id="q-email"
                    data-testid="quote-input-email"
                    type="email"
                    value={form.cliente_email}
                    onChange={(e) => set("cliente_email", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q-piva">P. IVA / C.F.</Label>
                  <Input
                    id="q-piva"
                    data-testid="quote-input-piva"
                    value={form.cliente_piva}
                    onChange={(e) => set("cliente_piva", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q-data">Data emissione</Label>
                  <Input
                    id="q-data"
                    data-testid="quote-input-data"
                    type="date"
                    value={form.data_emissione}
                    onChange={(e) => set("data_emissione", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q-validita">Validità (giorni)</Label>
                  <Input
                    id="q-validita"
                    data-testid="quote-input-validita"
                    type="number"
                    min="1"
                    value={form.validita_giorni}
                    onChange={(e) => set("validita_giorni", e.target.value)}
                  />
                </div>
              </div>
            </Card>

            <Card data-testid="editor-materiali" className="border-slate-800/80 bg-[#0F172A] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Materiali (dal catalogo)
              </p>
              <div className="mt-4 space-y-3">
                {form.matRows.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-400">
                    Nessun materiale: aggiungi le voci dal catalogo.
                  </p>
                )}
                {form.matRows.map((r, i) => (
                  <div
                    key={i}
                    data-testid={`quote-material-row-${i}`}
                    className="grid grid-cols-12 items-end gap-2 rounded-lg border border-slate-800 bg-[#1E293B] p-3"
                  >
                    <div className="col-span-12 space-y-1 sm:col-span-5">
                      <Label>Materiale</Label>
                      <Select value={r.materiale_id} onValueChange={(v) => onMaterialPick(i, v)}>
                        <SelectTrigger data-testid={`quote-line-material-select-${i}`} className="w-full">
                          <SelectValue>
                            {(v: string) => materiali?.find((m) => m.id === v)?.nome ?? "Seleziona…"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="border-slate-800 bg-[#0F172A]">
                          {(materiali ?? []).map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4 space-y-1 sm:col-span-2">
                      <Label>Q.tà {r.unita !== "pz" ? `(${r.unita})` : ""}</Label>
                      <Input
                        data-testid={`quote-material-qty-${i}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.quantita}
                        onChange={(e) => setMat(i, { quantita: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-4 space-y-1 sm:col-span-2">
                      <Label>Prezzo €</Label>
                      <Input
                        data-testid={`quote-material-price-${i}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.prezzo_unitario}
                        onChange={(e) => setMat(i, { prezzo_unitario: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-3 pb-2 text-right font-mono text-sm text-slate-300">
                      {fmtEuro(parseNum(r.quantita) * parseNum(r.prezzo_unitario))}
                    </div>
                    <div className="col-span-1 pb-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        data-testid={`quote-material-remove-${i}`}
                        onClick={() => removeMat(i)}
                        aria-label="Rimuovi riga materiale"
                        className="text-slate-400 hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" data-testid="btn-add-material-row" onClick={addMat}>
                  <Plus size={15} /> Aggiungi materiale
                </Button>
              </div>
            </Card>

            <Card data-testid="editor-manodopera" className="border-slate-800/80 bg-[#0F172A] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Manodopera
              </p>
              <div className="mt-4 space-y-3">
                {form.manRows.map((r, i) => (
                  <div
                    key={i}
                    data-testid={`quote-labor-row-${i}`}
                    className="grid grid-cols-12 items-end gap-2 rounded-lg border border-slate-800 bg-[#1E293B] p-3"
                  >
                    <div className="col-span-12 space-y-1 sm:col-span-5">
                      <Label>Descrizione</Label>
                      <Input
                        data-testid={`quote-labor-desc-${i}`}
                        value={r.descrizione}
                        onChange={(e) => setMan(i, { descrizione: e.target.value })}
                        placeholder="Es. Cablaggio e collaudo"
                      />
                    </div>
                    <div className="col-span-4 space-y-1 sm:col-span-2">
                      <Label>Ore</Label>
                      <Input
                        data-testid={`quote-labor-hours-input-${i}`}
                        type="number"
                        min="0"
                        step="0.5"
                        value={r.ore}
                        onChange={(e) => setMan(i, { ore: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-4 space-y-1 sm:col-span-2">
                      <Label>Tariffa €/h</Label>
                      <Input
                        data-testid={`quote-labor-rate-input-${i}`}
                        type="number"
                        min="0"
                        step="0.5"
                        value={r.tariffa_oraria}
                        onChange={(e) => setMan(i, { tariffa_oraria: e.target.value })}
                        placeholder="35"
                      />
                    </div>
                    <div className="col-span-3 pb-2 text-right font-mono text-sm text-slate-300">
                      {fmtEuro(parseNum(r.ore) * parseNum(r.tariffa_oraria))}
                    </div>
                    <div className="col-span-1 pb-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        data-testid={`quote-labor-remove-${i}`}
                        onClick={() => removeMan(i)}
                        aria-label="Rimuovi riga manodopera"
                        className="text-slate-400 hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" data-testid="btn-add-labor-row" onClick={addMan}>
                  <Plus size={15} /> Aggiungi manodopera
                </Button>
              </div>
            </Card>

            <Card data-testid="editor-note" className="border-slate-800/80 bg-[#0F172A] p-5">
              <Label htmlFor="q-note">Condizioni e note</Label>
              <Textarea
                id="q-note"
                data-testid="quote-textarea-note"
                value={form.note_condizioni}
                onChange={(e) => set("note_condizioni", e.target.value)}
                rows={3}
                className="mt-2"
              />
            </Card>
          </div>

          <div>
            <Card
              data-testid="quote-totals"
              className="border-slate-800/80 bg-[#0F172A] p-5 lg:sticky lg:top-20"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Riepilogo
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Materiali</dt>
                  <dd className="font-mono text-slate-100">{fmtEuro(subMat)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Manodopera</dt>
                  <dd className="font-mono text-slate-100">{fmtEuro(subMan)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Sconto</dt>
                  <dd className="font-mono text-slate-100">−{fmtEuro(scontoImp)}</dd>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2">
                  <dt className="text-slate-400">Imponibile</dt>
                  <dd className="font-mono text-slate-100">{fmtEuro(imponibile)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">IVA {parseNum(form.aliquota)}%</dt>
                  <dd className="font-mono text-slate-100">{fmtEuro(iva)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2.5">
                <span className="text-sm font-semibold text-amber-400">Totale</span>
                <span
                  className="font-mono text-xl font-medium text-amber-400"
                  data-testid="quote-total-display"
                >
                  {fmtEuro(totale)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="q-sconto">Sconto %</Label>
                  <Input
                    id="q-sconto"
                    data-testid="quote-sconto-input"
                    type="number"
                    min="0"
                    max="100"
                    value={form.sconto}
                    onChange={(e) => set("sconto", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q-iva">IVA</Label>
                  <Select value={form.aliquota} onValueChange={(v) => set("aliquota", v)}>
                    <SelectTrigger id="q-iva" data-testid="quote-iva-select" className="w-full">
                      <SelectValue>{(v: string) => `${v}%`}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-[#0F172A]">
                      <SelectItem value="22" data-testid="quote-iva-22">
                        22%
                      </SelectItem>
                      <SelectItem value="10" data-testid="quote-iva-10">
                        10% (agevolata)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
