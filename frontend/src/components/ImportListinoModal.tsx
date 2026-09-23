import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { ApiError, apiUpload } from "@/lib/api";
import type { Materiale } from "@/lib/types";
import { fmtEuro, fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RisultatoImport {
  creati: number;
  aggiornati: number;
  ignorati: number;
  totale_righe: number;
  colonne_riconosciute: Record<string, string>;
  avvisi: string[];
  anteprima: Materiale[];
}

interface ImportListinoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ETICHETTE_CAMPI: Record<string, string> = {
  nome: "Descrizione",
  codice_art: "Codice articolo",
  categoria: "Categoria",
  unita_misura: "Unità di misura",
  prezzo_unitario: "Prezzo vendita",
  prezzo_costo: "Prezzo costo",
  quantita_disponibile: "Giacenza",
  scorta_minima: "Scorta minima",
  fornitore: "Fornitore",
};

export default function ImportListinoModal({ open, onOpenChange }: ImportListinoModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [esito, setEsito] = useState<RisultatoImport | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const qc = useQueryClient();

  const importa = useMutation({
    mutationFn: (file: File) => apiUpload<RisultatoImport>("/materiali/import", file),
    onSuccess: async (res) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["materiali"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setEsito(res);
      toast.success(
        `Listino importato: ${res.creati} nuovi, ${res.aggiornati} aggiornati`,
      );
    },
    onError: (e) => {
      const detail =
        e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body
          ? String((e.body as { detail: unknown }).detail)
          : "Importazione non riuscita: controlla il file e riprova";
      toast.error(detail);
    },
  });

  const scegli = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setEsito(null);
    importa.mutate(file);
  };

  const chiudi = (aperto: boolean) => {
    if (!aperto) {
      setFileName("");
      setEsito(null);
    }
    onOpenChange(aperto);
  };

  return (
    <Dialog open={open} onOpenChange={chiudi}>
      <DialogContent
        data-testid="import-listino-modal"
        className="max-h-[90svh] overflow-y-auto border-[#27364F] bg-[#111827] sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-slate-100">Importa listino</DialogTitle>
          <DialogDescription className="text-slate-400">
            Carica il file del fornitore (Excel o CSV): riconosco da solo le colonne più comuni
            e popolo il catalogo in un colpo.
          </DialogDescription>
        </DialogHeader>

        {!esito && (
          <>
            <button
              type="button"
              data-testid="import-dropzone"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                scegli(e.dataTransfer.files?.[0]);
              }}
              disabled={importa.isPending}
              className={`flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-10 transition-colors duration-150 ${
                dragOver
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-[#27364F] hover:border-amber-500/50 hover:bg-[#162032]"
              }`}
            >
              {importa.isPending ? (
                <>
                  <Loader2 size={26} className="animate-spin text-amber-400" />
                  <span className="text-sm text-slate-300">Importo {fileName}…</span>
                </>
              ) : (
                <>
                  <Upload size={26} className="text-amber-400" />
                  <span className="text-sm font-medium text-slate-200">
                    Trascina qui il file o clicca per sceglierlo
                  </span>
                  <span className="text-xs text-slate-500">Formati: .xlsx, .csv — max 5 MB</span>
                </>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm,.csv"
              data-testid="import-file-input"
              onChange={(e) => scegli(e.target.files?.[0])}
              className="hidden"
            />

            <div className="rounded-xl border border-[#1E293B] bg-[#162032] p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Come deve essere il file
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Una riga per articolo, con almeno la <strong>descrizione</strong>. Riconosco anche
                codice, categoria, unità di misura, prezzo, costo, giacenza, scorta minima e
                fornitore — anche se le colonne hanno nomi diversi.
              </p>
              <a
                href="/api/materiali/import/modello"
                download
                data-testid="import-download-template"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-sky-400 transition-colors hover:text-sky-300"
              >
                <Download size={14} /> Scarica il modello Excel
              </a>
            </div>
          </>
        )}

        {esito && (
          <div className="space-y-3" data-testid="import-result">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Nuovi", value: esito.creati, testId: "import-count-creati", tone: "text-emerald-400" },
                { label: "Aggiornati", value: esito.aggiornati, testId: "import-count-aggiornati", tone: "text-sky-400" },
                { label: "Ignorati", value: esito.ignorati, testId: "import-count-ignorati", tone: "text-slate-300" },
              ].map((c) => (
                <div
                  key={c.label}
                  data-testid={c.testId}
                  className="rounded-xl border border-[#1E293B] bg-[#162032] p-3 text-center"
                >
                  <p className={`font-mono text-2xl font-bold ${c.tone}`}>{c.value}</p>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">{c.label}</p>
                </div>
              ))}
            </div>

            <p className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle2 size={15} className="text-emerald-400" />
              {esito.totale_righe} righe lette dal file {fileName}
            </p>

            {Object.keys(esito.colonne_riconosciute).length > 0 && (
              <div className="rounded-xl border border-[#1E293B] bg-[#162032] p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Colonne riconosciute
                </p>
                <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                  {Object.entries(esito.colonne_riconosciute).map(([campo, col]) => (
                    <li key={campo} data-testid={`import-mapped-${campo}`}>
                      «{col}» → {ETICHETTE_CAMPI[campo] ?? campo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {esito.avvisi.length > 0 && (
              <div
                className="rounded-xl border border-amber-500/25 bg-[#3D2708]/60 p-3"
                data-testid="import-warnings"
              >
                {esito.avvisi.map((a) => (
                  <p key={a} className="flex items-start gap-2 text-sm text-[#FBBF24]">
                    <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {a}
                  </p>
                ))}
              </div>
            )}

            {esito.anteprima.length > 0 && (
              <div className="space-y-1.5" data-testid="import-preview">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Anteprima
                </p>
                {esito.anteprima.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#1E293B] bg-[#162032] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-100">{m.nome}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {m.categoria}
                        {m.fornitore ? ` · ${m.fornitore}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-xs text-slate-300">
                      {fmtEuro(m.prezzo_unitario)}/{m.unita_misura} · {fmtNum(m.quantita_disponibile)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {esito ? (
            <>
              <Button
                variant="outline"
                data-testid="import-again"
                onClick={() => {
                  setEsito(null);
                  setFileName("");
                }}
              >
                <FileSpreadsheet size={15} /> Importa un altro file
              </Button>
              <Button
                data-testid="import-done"
                onClick={() => chiudi(false)}
                className="bg-amber-500 text-black hover:bg-amber-600"
              >
                Fatto
              </Button>
            </>
          ) : (
            <Button variant="outline" data-testid="import-cancel" onClick={() => chiudi(false)}>
              Chiudi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
