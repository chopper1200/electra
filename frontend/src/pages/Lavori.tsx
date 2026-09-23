import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ClipboardList,
  Clock,
  MessageCircle,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import type { Lavoro, StatoLavoro } from "@/lib/types";
import { fmtDate, fmtEuro, STATO_LAVORO_LABELS, waLink } from "@/lib/format";
import JobModal from "@/components/JobModal";
import OreModal from "@/components/OreModal";
import RecordMaterialUsageModal from "@/components/RecordMaterialUsageModal";
import StatusBadge from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATI: StatoLavoro[] = ["da_iniziare", "in_corso", "completato"];

const FILTRI: { value: "tutti" | StatoLavoro; label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "da_iniziare", label: "Da iniziare" },
  { value: "in_corso", label: "In corso" },
  { value: "completato", label: "Completati" },
];

export default function Lavori() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<"tutti" | StatoLavoro>("tutti");
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Lavoro | null>(null);
  const [usageTarget, setUsageTarget] = useState<Lavoro | null>(null);
  const [oreTarget, setOreTarget] = useState<Lavoro | null>(null);

  const { data: lavori, isLoading, isError } = useQuery({
    queryKey: ["lavori"],
    queryFn: () => apiGet<Lavoro[]>("/lavori"),
  });

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["lavori"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const cambiaStato = useMutation({
    mutationFn: ({ id, stato }: { id: string; stato: StatoLavoro }) =>
      apiPatch<Lavoro>(`/lavori/${id}/stato`, { stato }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Stato del lavoro aggiornato");
    },
    onError: () => toast.error("Errore nell'aggiornamento dello stato"),
  });

  const elimina = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/lavori/${id}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Lavoro eliminato");
    },
    onError: () => toast.error("Errore durante l'eliminazione del lavoro"),
  });

  const filtrati = (lavori ?? []).filter((l) => filtro === "tutti" || l.stato === filtro);

  const contatti = (l: Lavoro) =>
    l.cliente_telefono ? (
      <>
        <a
          href={`tel:${l.cliente_telefono.replace(/\s/g, "")}`}
          data-testid={`job-call-${l.id}`}
          aria-label="Chiama cliente"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-[#1E293B] hover:text-sky-400"
        >
          <Phone size={15} />
        </a>
        <a
          href={waLink(l.cliente_telefono)}
          target="_blank"
          rel="noreferrer"
          data-testid={`job-whatsapp-${l.id}`}
          aria-label="Scrivi su WhatsApp"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-[#1E293B] hover:text-emerald-400"
        >
          <MessageCircle size={15} />
        </a>
      </>
    ) : null;

  const azioniMenu = (l: Lavoro) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid={`job-actions-${l.id}`}
        aria-label="Azioni lavoro"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-[#1E293B] hover:text-slate-100"
      >
        <MoreVertical size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-[#1E293B] bg-[#111827]">
        <DropdownMenuItem
          data-testid={`job-usage-${l.id}`}
          onClick={() => setUsageTarget(l)}
        >
          <ClipboardList size={15} /> Registra materiali
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid={`job-ore-${l.id}`}
          onClick={() => setOreTarget(l)}
        >
          <Clock size={15} /> Registro ore
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid={`job-edit-${l.id}`}
          onClick={() => {
            setEditTarget(l);
            setJobModalOpen(true);
          }}
        >
          <Pencil size={15} /> Modifica
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          data-testid={`job-delete-${l.id}`}
          onClick={() => elimina.mutate(l.id)}
        >
          <Trash2 size={15} /> Elimina
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const statoSelect = (l: Lavoro) => (
    <Select
      value={l.stato}
      onValueChange={(v) => cambiaStato.mutate({ id: l.id, stato: v as StatoLavoro })}
    >
      <SelectTrigger size="sm" data-testid={`job-status-${l.id}`} className="w-[140px]">
        <SelectValue>{(v: string) => STATO_LAVORO_LABELS[v as StatoLavoro]}</SelectValue>
      </SelectTrigger>
      <SelectContent className="border-[#1E293B] bg-[#111827]">
        {STATI.map((s) => (
          <SelectItem key={s} value={s} data-testid={`job-stato-option-${s}`}>
            {STATO_LAVORO_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-100">Lavori</h1>
          <p className="text-sm text-slate-400">
            Cantieri e interventi per i tuoi clienti
          </p>
        </div>
        <Button
          data-testid="btn-create-job"
          onClick={() => {
            setEditTarget(null);
            setJobModalOpen(true);
          }}
          className="min-h-11 bg-amber-500 text-black hover:bg-amber-600"
        >
          <Plus size={16} /> Nuovo lavoro
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtra per stato">
        {FILTRI.map((f) => (
          <button
            key={f.value}
            data-testid={`filter-lavori-${f.value}`}
            onClick={() => setFiltro(f.value)}
            className={`min-h-9 rounded-full border px-4 text-sm font-medium transition-colors ${
              filtro === f.value
                ? "border-amber-500/60 bg-[#3D2708] text-[#FBBF24]"
                : "border-[#27364F] bg-[#111827] text-slate-300 hover:border-slate-500"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#111827]" />
          ))}
        </div>
      ) : isError ? (
        <p className="rounded-lg border border-[#1E293B] bg-[#111827] px-4 py-6 text-sm text-slate-400" data-testid="lavori-error">
          Dati non disponibili al momento.
        </p>
      ) : filtrati.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#27364F] px-4 py-12 text-center" data-testid="lavori-empty">
          <Wrench size={28} className="mx-auto text-slate-500" />
          <p className="mt-3 text-sm text-slate-400">
            Nessun lavoro in questo filtro. Creane uno per iniziare.
          </p>
        </div>
      ) : (
        <>
          {/* Vista tabella — desktop */}
          <Table data-testid="lavori-table" className="hidden md:table">
            <TableHeader>
              <TableRow className="border-[#1E293B]">
                <TableHead className="text-slate-400">Lavoro</TableHead>
                <TableHead className="text-slate-400">Stato</TableHead>
                <TableHead className="text-slate-400">Inizio</TableHead>
                <TableHead className="text-right text-slate-400">Prezzo</TableHead>
                <TableHead className="text-slate-400">Materiali</TableHead>
                <TableHead className="text-right text-slate-400">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrati.map((l) => (
                <TableRow key={l.id} data-testid={`job-row-${l.id}`} className="border-[#1E293B]">
                  <TableCell>
                    <p className="font-medium text-slate-100">{l.titolo}</p>
                    <p className="text-sm text-slate-400">
                      {l.cliente_nome}
                      {l.cliente_indirizzo ? ` — ${l.cliente_indirizzo}` : ""}
                    </p>
                  </TableCell>
                  <TableCell>{statoSelect(l)}</TableCell>
                  <TableCell className="font-mono text-sm text-slate-300">
                    {fmtDate(l.data_inizio)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-100">
                    {fmtEuro(l.prezzo_pattuito)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      data-testid={`job-materials-count-${l.id}`}
                      className="bg-slate-800 text-slate-300"
                    >
                      {l.materiali_usati.length} voci
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {contatti(l)}
                      {azioniMenu(l)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Vista card — mobile */}
          <div className="space-y-3 md:hidden" data-testid="lavori-cards">
            {filtrati.map((l) => (
              <div
                key={l.id}
                data-testid={`job-card-${l.id}`}
                className="rounded-xl border border-[#1E293B] bg-[#111827] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100">{l.titolo}</p>
                    <p className="text-sm text-slate-400">
                      {l.cliente_nome}
                      {l.cliente_indirizzo ? ` — ${l.cliente_indirizzo}` : ""}
                    </p>
                  </div>
                  <StatusBadge kind="lavoro" stato={l.stato} />
                </div>
                <div className="mt-3 flex items-center justify-between font-mono text-sm">
                  <span className="text-slate-400">
                    {fmtDate(l.data_inizio)}
                    {l.data_fine_prevista ? ` → ${fmtDate(l.data_fine_prevista)}` : ""}
                  </span>
                  <span className="text-slate-100">{fmtEuro(l.prezzo_pattuito)}</span>
                </div>
                <div className="mt-3 flex items-center gap-1 border-t border-[#1E293B] pt-3">
                  {contatti(l)}
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`job-usage-mobile-${l.id}`}
                    onClick={() => setUsageTarget(l)}
                    className="ml-auto"
                  >
                    <ClipboardList size={15} /> Materiali
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`job-ore-mobile-${l.id}`}
                    onClick={() => setOreTarget(l)}
                  >
                    <Clock size={15} /> Ore
                  </Button>
                  {azioniMenu(l)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <JobModal
        open={jobModalOpen}
        onOpenChange={setJobModalOpen}
        lavoro={editTarget}
      />
      <RecordMaterialUsageModal
        open={usageTarget !== null}
        onOpenChange={(o) => {
          if (!o) setUsageTarget(null);
        }}
        lavoro={usageTarget}
      />
      <OreModal
        open={oreTarget !== null}
        onOpenChange={(o) => {
          if (!o) setOreTarget(null);
        }}
        lavoro={oreTarget}
      />
    </div>
  );
}
