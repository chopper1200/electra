import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Copy,
  FileSpreadsheet,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Lavoro, Preventivo } from "@/lib/types";
import { fmtDate, fmtEuro } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Preventivi() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: preventivi, isLoading, isError } = useQuery({
    queryKey: ["preventivi"],
    queryFn: () => apiGet<Preventivo[]>("/preventivi"),
  });

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["preventivi"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const duplica = useMutation({
    mutationFn: (id: string) => apiPost<Preventivo>(`/preventivi/${id}/duplica`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Preventivo duplicato come bozza");
    },
    onError: () => toast.error("Errore durante la duplicazione"),
  });

  const converti = useMutation({
    mutationFn: (id: string) => apiPost<Lavoro>(`/preventivi/${id}/converti`),
    onSuccess: async () => {
      await Promise.all([invalidate(), qc.invalidateQueries({ queryKey: ["lavori"] })]);
      toast.success("Lavoro creato dal preventivo");
    },
    onError: () => toast.error("Errore durante la conversione in lavoro"),
  });

  const elimina = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/preventivi/${id}`),
    onSuccess: async () => {
      await invalidate();
      toast.success("Preventivo eliminato");
    },
    onError: () => toast.error("Errore durante l'eliminazione del preventivo"),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-100">
            Preventivi
          </h1>
          <p className="text-sm text-slate-400">Offerte ai clienti con materiali e manodopera</p>
        </div>
        <Link
          to="/preventivi/nuovo"
          data-testid="btn-create-quote"
          className={buttonVariants({ variant: "default" })}
        >
          <Plus size={16} /> Nuovo preventivo
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-[#0F172A]" />
          ))}
        </div>
      ) : isError ? (
        <p className="rounded-lg border border-slate-800 bg-[#0F172A] px-4 py-6 text-sm text-slate-400" data-testid="preventivi-error">
          Dati non disponibili al momento.
        </p>
      ) : (preventivi ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 px-4 py-12 text-center" data-testid="preventivi-empty">
          <FileSpreadsheet size={28} className="mx-auto text-slate-500" />
          <p className="mt-3 text-sm text-slate-400">
            Nessun preventivo ancora. Crea il primo con «Nuovo preventivo».
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="preventivi-grid">
          {(preventivi ?? []).map((p) => (
            <Card
              key={p.id}
              data-testid={`quote-card-${p.id}`}
              className="flex flex-col border-slate-800/80 bg-[#0F172A] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-medium text-amber-400">{p.numero}</span>
                <StatusBadge kind="preventivo" stato={p.stato} />
              </div>
              <Link to={`/preventivi/${p.id}`} data-testid={`quote-link-${p.id}`} className="mt-2 block">
                <p className="font-heading text-lg font-semibold text-slate-100">
                  {p.cliente_nome}
                </p>
                <p className="text-sm text-slate-400">{p.titolo_intervento}</p>
              </Link>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="text-xs text-slate-500">
                  <p>Emissione: {fmtDate(p.data_emissione)}</p>
                  <p>Validità: {p.validita_giorni} giorni</p>
                </div>
                <p className="font-mono text-xl font-medium text-slate-100" data-testid={`quote-total-${p.id}`}>
                  {fmtEuro(p.totale_preventivo)}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
                <Link
                  to={`/preventivi/${p.id}`}
                  data-testid={`quote-open-${p.id}`}
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                >
                  Dettagli
                </Link>
                {p.lavoro_id && (
                  <span className="text-xs font-medium text-emerald-400" data-testid={`quote-converted-${p.id}`}>
                    Convertito in lavoro
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    data-testid={`quote-actions-${p.id}`}
                    aria-label="Azioni preventivo"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
                  >
                    <MoreVertical size={16} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border-slate-800 bg-[#0F172A]">
                    {p.stato === "bozza" && (
                      <DropdownMenuItem
                        data-testid={`quote-edit-${p.id}`}
                        onClick={() => navigate(`/preventivi/${p.id}/modifica`)}
                      >
                        <Pencil size={15} /> Modifica
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      data-testid={`quote-duplicate-${p.id}`}
                      onClick={() => duplica.mutate(p.id)}
                    >
                      <Copy size={15} /> Duplica
                    </DropdownMenuItem>
                    {p.stato === "accettato" && !p.lavoro_id && (
                      <DropdownMenuItem
                        data-testid={`quote-convert-${p.id}`}
                        onClick={() => converti.mutate(p.id)}
                      >
                        <Wrench size={15} /> Crea lavoro da preventivo
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      data-testid={`quote-delete-${p.id}`}
                      onClick={() => elimina.mutate(p.id)}
                    >
                      <Trash2 size={15} /> Elimina
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
