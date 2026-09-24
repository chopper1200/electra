import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  MoreVertical,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Upload,
} from "lucide-react";
import { apiDelete, apiGet, STATIC_MODE } from "@/lib/api";
import type { Materiale } from "@/lib/types";
import { CATEGORIE, fmtEuro, fmtNum } from "@/lib/format";
import CaricoRapidoModal from "@/components/CaricoRapidoModal";
import ImportListinoModal from "@/components/ImportListinoModal";
import MaterialModal from "@/components/MaterialModal";
import RicaricoPrezziModal from "@/components/RicaricoPrezziModal";
import StockModal from "@/components/StockModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Materiali() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("tutte");
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Materiale | null>(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [stockTarget, setStockTarget] = useState<Materiale | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [ricaricoOpen, setRicaricoOpen] = useState(false);
  const [caricoOpen, setCaricoOpen] = useState(false);

  const { data: materiali, isLoading, isError } = useQuery({
    queryKey: ["materiali"],
    queryFn: () => apiGet<Materiale[]>("/materiali"),
  });

  const elimina = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/materiali/${id}`),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["materiali"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success("Materiale eliminato dal catalogo");
    },
    onError: () => toast.error("Errore durante l'eliminazione del materiale"),
  });

  const bassi = (materiali ?? []).filter((m) => m.quantita_disponibile <= m.scorta_minima);
  const q = search.trim().toLowerCase();
  const filtrati = (materiali ?? []).filter(
    (m) =>
      (categoria === "tutte" || m.categoria === categoria) &&
      (m.nome.toLowerCase().includes(q) || m.codice_art.toLowerCase().includes(q)),
  );

  const azioniMenu = (m: Materiale) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid={`material-actions-${m.id}`}
        aria-label="Azioni materiale"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-[#1E293B] hover:text-slate-100"
      >
        <MoreVertical size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-[#1E293B] bg-[#111827]">
        <DropdownMenuItem
          data-testid={`material-restock-${m.id}`}
          onClick={() => {
            setStockTarget(m);
            setStockOpen(true);
          }}
        >
          <PackagePlus size={15} /> Regola scorta
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid={`material-edit-${m.id}`}
          onClick={() => {
            setEditTarget(m);
            setEditOpen(true);
          }}
        >
          <Pencil size={15} /> Modifica
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          data-testid={`material-delete-${m.id}`}
          onClick={() => elimina.mutate(m.id)}
        >
          <Trash2 size={15} /> Elimina
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const giacenzaCell = (m: Materiale) => {
    const basso = m.quantita_disponibile <= m.scorta_minima;
    return (
      <div className="flex items-center gap-2">
        <span
          className={`font-mono text-sm ${basso ? "text-amber-400" : "text-slate-100"}`}
          data-testid={`material-stock-${m.id}`}
        >
          {fmtNum(m.quantita_disponibile)} {m.unita_misura}
        </span>
        {basso && (
          <Badge
            variant="outline"
            data-testid={`material-low-badge-${m.id}`}
            className="border-amber-500/40 bg-[#3D2708] text-[#FBBF24]"
          >
            <AlertTriangle size={11} /> Sotto scorta
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-100">
            Materiali
          </h1>
          <p className="text-sm text-slate-400">Catalogo e giacenze di magazzino</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            data-testid="btn-carico-rapido"
            onClick={() => setCaricoOpen(true)}
            className="min-h-11"
          >
            <PackagePlus size={16} /> Carico rapido
          </Button>
          <Button
            variant="outline"
            data-testid="btn-ricarico-prezzi"
            onClick={() => setRicaricoOpen(true)}
            className="min-h-11"
          >
            <TrendingUp size={16} /> Ricarico prezzi
          </Button>
          {!STATIC_MODE && (
          <Button
            variant="outline"
            data-testid="btn-import-listino"
            onClick={() => setImportOpen(true)}
            className="min-h-11"
          >
            <Upload size={16} /> Importa listino
          </Button>
          )}
          <Button
            data-testid="btn-create-material"
            onClick={() => {
              setEditTarget(null);
              setEditOpen(true);
            }}
            className="min-h-11 bg-amber-500 text-black hover:bg-amber-600"
          >
            <Plus size={16} /> Nuovo materiale
          </Button>
        </div>
      </div>

      {bassi.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-testid="low-stock-summary">
          <span className="flex items-center gap-1.5 text-sm font-medium text-amber-400">
            <AlertTriangle size={15} /> {bassi.length} articoli da riordinare:
          </span>
          {bassi.map((m) => (
            <span
              key={m.id}
              data-testid={`low-stock-chip-${m.id}`}
              className="rounded-full border border-amber-500/30 bg-[#3D2708] px-3 py-1 text-xs text-[#FBBF24]"
            >
              {m.nome}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full space-y-1.5 sm:max-w-xs">
          <Label htmlFor="mat-search">Cerca</Label>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <Input
              id="mat-search"
              data-testid="material-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome o codice articolo…"
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-full space-y-1.5 sm:max-w-[240px]">
          <Label htmlFor="mat-categoria-filter">Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger id="mat-categoria-filter" data-testid="material-filter-categoria" className="w-full">
              <SelectValue>{(v: string) => (v === "tutte" ? "Tutte le categorie" : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent className="border-[#1E293B] bg-[#111827]">
              <SelectItem value="tutte" data-testid="material-filter-tutte">
                Tutte le categorie
              </SelectItem>
              {CATEGORIE.map((c) => (
                <SelectItem key={c} value={c} data-testid={`material-filter-opt-${c.slice(0, 10)}`}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-[#111827]" />
          ))}
        </div>
      ) : isError ? (
        <p className="rounded-lg border border-[#1E293B] bg-[#111827] px-4 py-6 text-sm text-slate-400" data-testid="materiali-error">
          Dati non disponibili al momento.
        </p>
      ) : filtrati.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#27364F] px-4 py-12 text-center" data-testid="materiali-empty">
          <Package size={28} className="mx-auto text-slate-500" />
          <p className="mt-3 text-sm text-slate-400">
            {materiali?.length
              ? "Nessun materiale trovato con questa ricerca."
              : "Catalogo vuoto. Importa il listino del tuo fornitore o aggiungi il primo articolo a mano."}
          </p>
          {!materiali?.length && !STATIC_MODE && (
            <Button
              variant="outline"
              data-testid="empty-import-listino"
              onClick={() => setImportOpen(true)}
              className="mt-4"
            >
              <Upload size={15} /> Importa listino
            </Button>
          )}
        </div>
      ) : (
        <>
          <Table data-testid="materiali-table" className="hidden md:table">
            <TableHeader>
              <TableRow className="border-[#1E293B]">
                <TableHead className="text-slate-400">Materiale</TableHead>
                <TableHead className="text-slate-400">Categoria</TableHead>
                <TableHead className="text-right text-slate-400">Prezzo</TableHead>
                <TableHead className="text-slate-400">Giacenza</TableHead>
                <TableHead className="text-slate-400">Fornitore</TableHead>
                <TableHead className="text-right text-slate-400">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrati.map((m) => (
                <TableRow key={m.id} data-testid={`material-row-${m.id}`} className="border-[#1E293B]">
                  <TableCell>
                    <p className="font-medium text-slate-100">{m.nome}</p>
                    {m.codice_art && <p className="font-mono text-xs text-slate-500">{m.codice_art}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-slate-300">{m.categoria}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-100">
                    {fmtEuro(m.prezzo_unitario)}
                    <span className="text-slate-500">/{m.unita_misura}</span>
                  </TableCell>
                  <TableCell>{giacenzaCell(m)}</TableCell>
                  <TableCell className="text-sm text-slate-300">{m.fornitore || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end">{azioniMenu(m)}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="space-y-3 md:hidden" data-testid="materiali-cards">
            {filtrati.map((m) => (
              <div
                key={m.id}
                data-testid={`material-card-${m.id}`}
                className="rounded-xl border border-[#1E293B] bg-[#111827] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100">{m.nome}</p>
                    <p className="text-xs text-slate-400">{m.categoria}</p>
                  </div>
                  {azioniMenu(m)}
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-sm">
                  <span className="text-slate-100">{fmtEuro(m.prezzo_unitario)}/{m.unita_misura}</span>
                  {giacenzaCell(m)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <MaterialModal open={editOpen} onOpenChange={setEditOpen} materiale={editTarget} />
      <StockModal open={stockOpen} onOpenChange={setStockOpen} materiale={stockTarget} />
      <ImportListinoModal open={importOpen} onOpenChange={setImportOpen} />
      <RicaricoPrezziModal open={ricaricoOpen} onOpenChange={setRicaricoOpen} />
      <CaricoRapidoModal open={caricoOpen} onOpenChange={setCaricoOpen} />
    </div>
  );
}
