import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Package, ShoppingCart } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { ListaSpesaUnica } from "@/lib/types";
import { fmtEuro, fmtNum } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Spesa() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["lista-spesa-unica"],
    queryFn: () => apiGet<ListaSpesaUnica>("/lavori/lista-spesa/unica"),
  });

  const righe = data?.righe ?? [];
  const daComprare = righe.filter((r) => r.mancante > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-100">
            Lista della spesa
          </h1>
          <p className="text-sm text-slate-400">
            Tutti i materiali mancanti dei cantieri aperti, in un'unica lista da portare dal
            fornitore
          </p>
        </div>
        <div className="rounded-xl border border-[#27364F] bg-[#111827] px-4 py-3 text-right">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Spesa stimata</p>
          <p className="font-mono text-xl text-amber-400" data-testid="spesa-totale">
            {fmtEuro(data?.totale_stimato ?? 0)}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-[#111827]" />
      ) : isError ? (
        <p
          data-testid="spesa-error"
          className="rounded-lg border border-[#1E293B] bg-[#111827] px-4 py-6 text-sm text-slate-400"
        >
          Dati non disponibili al momento.
        </p>
      ) : righe.length === 0 ? (
        <div
          data-testid="spesa-empty"
          className="rounded-2xl border border-dashed border-[#27364F] px-4 py-12 text-center"
        >
          <ShoppingCart size={28} className="mx-auto text-slate-500" />
          <p className="mt-3 text-sm text-slate-400">
            Nessun materiale da comprare: aggiungi voci alla lista di un{" "}
            <Link to="/lavori" data-testid="spesa-link-lavori" className="text-amber-400 underline">
              cantiere aperto
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <Card className="flex-1 border-[#1E293B] bg-[#111827] p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">Cantieri aperti</p>
              <p className="font-mono text-2xl text-slate-100" data-testid="spesa-cantieri">
                {data?.cantieri_aperti ?? 0}
              </p>
            </Card>
            <Card className="flex-1 border-[#1E293B] bg-[#111827] p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">Articoli</p>
              <p className="font-mono text-2xl text-slate-100" data-testid="spesa-articoli">
                {righe.length}
              </p>
            </Card>
            <Card className="flex-1 border-[#1E293B] bg-[#111827] p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">Da acquistare</p>
              <p className="font-mono text-2xl text-amber-400" data-testid="spesa-mancanti">
                {daComprare.length}
              </p>
            </Card>
          </div>

          <Table data-testid="spesa-table" className="hidden md:table">
            <TableHeader>
              <TableRow className="border-[#1E293B]">
                <TableHead className="text-slate-400">Articolo</TableHead>
                <TableHead className="text-right text-slate-400">Serve</TableHead>
                <TableHead className="text-right text-slate-400">Giacenza</TableHead>
                <TableHead className="text-right text-slate-400">Da comprare</TableHead>
                <TableHead className="text-right text-slate-400">Costo stimato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {righe.map((r) => (
                <TableRow
                  key={r.chiave}
                  data-testid={`spesa-row-${r.chiave}`}
                  className="border-[#1E293B]"
                >
                  <TableCell>
                    <p className="font-medium text-slate-100">{r.nome}</p>
                    <p className="text-xs text-slate-400" data-testid={`spesa-cantieri-${r.chiave}`}>
                      {r.cantieri
                        .map((c) => `${c.titolo} (${fmtNum(c.quantita)} ${r.unita})`)
                        .join(" · ")}
                    </p>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-300">
                    {fmtNum(r.quantita_richiesta)} {r.unita}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-400">
                    {r.giacenza === null ? "—" : `${fmtNum(r.giacenza)} ${r.unita}`}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-sm ${
                      r.mancante > 0 ? "text-red-400" : "text-emerald-400"
                    }`}
                    data-testid={`spesa-mancante-${r.chiave}`}
                  >
                    {r.mancante > 0 ? `${fmtNum(r.mancante)} ${r.unita}` : "in magazzino"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-slate-100">
                    {fmtEuro(r.costo_stimato)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="space-y-3 md:hidden" data-testid="spesa-cards">
            {righe.map((r) => (
              <div
                key={r.chiave}
                data-testid={`spesa-card-${r.chiave}`}
                className="rounded-xl border border-[#1E293B] bg-[#111827] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-100">{r.nome}</p>
                  <span
                    className={`shrink-0 font-mono text-sm ${
                      r.mancante > 0 ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {r.mancante > 0 ? `+${fmtNum(r.mancante)} ${r.unita}` : "ok"}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-400">
                  <Package size={12} className="mr-1 inline" />
                  serve {fmtNum(r.quantita_richiesta)} {r.unita} · giacenza{" "}
                  {r.giacenza === null ? "—" : fmtNum(r.giacenza)} · {fmtEuro(r.costo_stimato)}
                </p>
                <p className="mt-2 border-t border-[#1E293B] pt-2 text-xs text-slate-400">
                  {r.cantieri.map((c) => c.titolo).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
