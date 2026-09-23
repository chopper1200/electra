import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Mail,
  MapPin,
  MessageCircle,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { apiDelete, apiGet } from "@/lib/api";
import type { Cliente, Lavoro, Preventivo } from "@/lib/types";
import { fmtEuro, waLink } from "@/lib/format";
import ClienteModal from "@/components/ClienteModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Clienti() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Cliente | null>(null);

  const { data: clienti, isLoading, isError } = useQuery({
    queryKey: ["clienti"],
    queryFn: () => apiGet<Cliente[]>("/clienti"),
  });
  const { data: lavori } = useQuery({
    queryKey: ["lavori"],
    queryFn: () => apiGet<Lavoro[]>("/lavori"),
  });
  const { data: preventivi } = useQuery({
    queryKey: ["preventivi"],
    queryFn: () => apiGet<Preventivo[]>("/preventivi"),
  });

  const elimina = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/clienti/${id}`),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["clienti"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success("Cliente eliminato dall'anagrafica");
    },
    onError: () => toast.error("Errore durante l'eliminazione del cliente"),
  });

  const q = search.trim().toLowerCase();
  const filtrati = (clienti ?? []).filter(
    (c) =>
      c.nome.toLowerCase().includes(q) ||
      c.indirizzo.toLowerCase().includes(q) ||
      c.telefono.includes(q),
  );

  const storico = (nome: string) => {
    const key = nome.trim().toLowerCase();
    const suoiLavori = (lavori ?? []).filter(
      (l) => l.cliente_nome.trim().toLowerCase() === key,
    );
    const suoiPreventivi = (preventivi ?? []).filter(
      (p) => p.cliente_nome.trim().toLowerCase() === key,
    );
    return {
      lavori: suoiLavori.length,
      preventivi: suoiPreventivi.length,
      valore: suoiLavori.reduce((s, l) => s + l.prezzo_pattuito, 0),
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-50">
            Anagrafica clienti
          </h1>
          <p className="text-sm text-slate-400">
            Salvati una volta, poi li ricarichi con un click in lavori e preventivi
          </p>
        </div>
        <Button
          data-testid="btn-create-cliente"
          onClick={() => {
            setEditTarget(null);
            setModalOpen(true);
          }}
          className="min-h-11 bg-amber-500 text-black hover:bg-amber-600"
        >
          <Plus size={16} /> Nuovo cliente
        </Button>
      </div>

      <div className="w-full max-w-sm space-y-1.5">
        <Label htmlFor="cli-search">Cerca</Label>
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <Input
            id="cli-search"
            data-testid="cliente-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome, indirizzo o telefono…"
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-[#111827]" />
          ))}
        </div>
      ) : isError ? (
        <p
          className="rounded-xl border border-[#1E293B] bg-[#111827] px-4 py-6 text-sm text-slate-400"
          data-testid="clienti-error"
        >
          Dati non disponibili al momento.
        </p>
      ) : filtrati.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-[#27364F] px-4 py-12 text-center"
          data-testid="clienti-empty"
        >
          <UserRound size={28} className="mx-auto text-slate-500" />
          <p className="mt-3 text-sm text-slate-400">
            {clienti?.length
              ? "Nessun cliente trovato con questa ricerca."
              : "Nessun cliente ancora. I clienti si salvano da soli quando crei un lavoro o un preventivo."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="clienti-grid">
          {filtrati.map((c) => {
            const s = storico(c.nome);
            return (
              <Card
                key={c.id}
                data-testid={`cliente-card-${c.id}`}
                className="group gap-0 border-[#1E293B] bg-[#111827] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#334155]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 font-heading text-base font-bold text-amber-400">
                      {c.nome.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p
                        className="truncate font-heading text-base font-semibold text-slate-50"
                        data-testid={`cliente-nome-${c.id}`}
                      >
                        {c.nome}
                      </p>
                      {c.piva && (
                        <p className="truncate font-mono text-[11px] text-slate-500">
                          P.IVA {c.piva}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      data-testid={`cliente-actions-${c.id}`}
                      aria-label="Azioni cliente"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#162032] hover:text-slate-100"
                    >
                      <MoreVertical size={16} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-[#27364F] bg-[#162032]">
                      <DropdownMenuItem
                        data-testid={`cliente-edit-${c.id}`}
                        onClick={() => {
                          setEditTarget(c);
                          setModalOpen(true);
                        }}
                      >
                        <Pencil size={15} /> Modifica
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        data-testid={`cliente-delete-${c.id}`}
                        onClick={() => elimina.mutate(c.id)}
                      >
                        <Trash2 size={15} /> Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-slate-400">
                  {c.indirizzo && (
                    <p className="flex items-start gap-2">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-slate-500" />
                      <span className="min-w-0">{c.indirizzo}</span>
                    </p>
                  )}
                  {c.telefono && (
                    <p className="flex items-center gap-2 font-mono text-[13px]">
                      <Phone size={14} className="shrink-0 text-slate-500" /> {c.telefono}
                    </p>
                  )}
                  {c.email && (
                    <p className="flex items-center gap-2">
                      <Mail size={14} className="shrink-0 text-slate-500" />
                      <span className="truncate">{c.email}</span>
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-[#1E293B] pt-4">
                  <Badge
                    variant="secondary"
                    data-testid={`cliente-stats-${c.id}`}
                    className="bg-[#162032] font-mono text-slate-300"
                  >
                    {s.lavori} lavori · {s.preventivi} prev.
                  </Badge>
                  {s.valore > 0 && (
                    <span className="font-mono text-xs text-emerald-400">{fmtEuro(s.valore)}</span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    {c.telefono && (
                      <>
                        <a
                          href={`tel:${c.telefono.replace(/\s/g, "")}`}
                          data-testid={`cliente-call-${c.id}`}
                          aria-label="Chiama cliente"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#162032] hover:text-sky-400"
                        >
                          <Phone size={15} />
                        </a>
                        <a
                          href={waLink(c.telefono)}
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`cliente-whatsapp-${c.id}`}
                          aria-label="Scrivi su WhatsApp"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#162032] hover:text-emerald-400"
                        >
                          <MessageCircle size={15} />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ClienteModal open={modalOpen} onOpenChange={setModalOpen} cliente={editTarget} />
    </div>
  );
}
