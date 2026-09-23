import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Pencil,
  Printer,
  Send,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Lavoro, Preventivo } from "@/lib/types";
import { fmtDate, fmtEuro, fmtNum } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function PreventivoDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data: p, isLoading, isError } = useQuery({
    queryKey: ["preventivo", id],
    queryFn: () => apiGet<Preventivo>(`/preventivi/${id}`),
    enabled: Boolean(id),
  });

  const cambiaStato = useMutation({
    mutationFn: (stato: string) => apiPatch<Preventivo>(`/preventivi/${id}/stato`, { stato }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["preventivo", id] }),
        qc.invalidateQueries({ queryKey: ["preventivi"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success("Stato del preventivo aggiornato");
    },
    onError: () => toast.error("Errore nell'aggiornamento dello stato"),
  });

  const converti = useMutation({
    mutationFn: () => apiPost<Lavoro>(`/preventivi/${id}/converti`),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["preventivo", id] }),
        qc.invalidateQueries({ queryKey: ["preventivi"] }),
        qc.invalidateQueries({ queryKey: ["lavori"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success("Lavoro creato dal preventivo");
    },
    onError: () => toast.error("Errore durante la conversione in lavoro"),
  });

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2" data-testid="quote-toolbar">
        <Link
          to="/preventivi"
          data-testid="quote-back-link"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft size={15} /> Preventivi
        </Link>
        <div className="flex-1" />
        {p && (
          <>
            {p.stato === "bozza" && (
              <>
                <Link
                  to={`/preventivi/${p.id}/modifica`}
                  data-testid="btn-edit-quote"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Pencil size={15} /> Modifica
                </Link>
                <Button
                  size="sm"
                  data-testid="btn-send-quote"
                  onClick={() => cambiaStato.mutate("inviato")}
                  className="bg-sky-500 text-black hover:bg-sky-600"
                >
                  <Send size={15} /> Invia
                </Button>
              </>
            )}
            {p.stato === "inviato" && (
              <>
                <Button
                  size="sm"
                  data-testid="btn-accept-quote"
                  onClick={() => cambiaStato.mutate("accettato")}
                  className="bg-emerald-500 text-black hover:bg-emerald-600"
                >
                  <CheckCircle2 size={15} /> Accetta
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="btn-reject-quote"
                  onClick={() => cambiaStato.mutate("rifiutato")}
                  className="border-red-500/40 text-red-300 hover:text-red-200"
                >
                  <XCircle size={15} /> Rifiuta
                </Button>
              </>
            )}
            {p.stato === "accettato" && !p.lavoro_id && (
              <Button
                size="sm"
                data-testid="btn-convert-quote-to-job"
                onClick={() => converti.mutate()}
                className="bg-amber-500 text-black hover:bg-amber-600"
              >
                <Wrench size={15} /> Converti in lavoro
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              data-testid="btn-print-quote"
              onClick={() => window.print()}
            >
              <Printer size={15} /> Stampa / PDF
            </Button>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="mx-auto h-[600px] w-full max-w-3xl animate-pulse rounded-xl bg-[#111827]" />
      ) : isError || !p ? (
        <Card className="border-[#1E293B] bg-[#111827] p-8 text-center" data-testid="quote-detail-error">
          <p className="text-sm text-slate-400">Preventivo non disponibile al momento.</p>
          <Link
            to="/preventivi"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Torna ai preventivi
          </Link>
        </Card>
      ) : (
        <section
          className="print-sheet mx-auto w-full max-w-3xl rounded-xl bg-white p-6 text-slate-900 shadow-xl sm:p-10"
          data-testid="quote-sheet"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#B45309] pb-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#B45309] text-white">
                <Zap size={22} />
              </span>
              <div>
                <p className="font-heading text-xl font-bold text-slate-900">VoltCraft Elettrica</p>
                <p className="text-xs text-slate-500">
                  Impianti elettrici · Manutenzione · Certificazioni
                </p>
                <p className="text-xs text-slate-500">Tel. +39 333 000 0000 · info@voltcraft.it</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#B45309]">
                Preventivo
              </p>
              <p className="font-mono text-lg font-bold text-slate-900" data-testid="quote-number">
                {p.numero}
              </p>
              <p className="text-xs text-slate-500">Emissione: {fmtDate(p.data_emissione)}</p>
              <p className="text-xs text-slate-500">Validità: {p.validita_giorni} giorni</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Cliente
              </p>
              <p className="mt-1 font-semibold text-slate-900" data-testid="quote-client">
                {p.cliente_nome}
              </p>
              <div className="text-sm text-slate-600">
                {p.cliente_indirizzo && <p>{p.cliente_indirizzo}</p>}
                {p.cliente_telefono && <p>{p.cliente_telefono}</p>}
                {p.cliente_email && <p>{p.cliente_email}</p>}
                {p.cliente_piva && <p>P.IVA {p.cliente_piva}</p>}
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Stato
              </p>
              <div className="mt-1">
                <StatusBadge kind="preventivo" stato={p.stato} scaduto={p.scaduto} />
              </div>
              {p.lavoro_id && (
                <p
                  className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                  data-testid="quote-converted-chip"
                >
                  Convertito in lavoro
                </p>
              )}
            </div>
          </div>

          <h2 className="mt-6 font-heading text-2xl font-bold text-slate-900" data-testid="quote-title">
            {p.titolo_intervento}
          </h2>

          {p.voci_materiali.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold uppercase tracking-wider text-slate-500">
                Materiali
              </h3>
              <table className="mt-2 w-full border-collapse text-sm" data-testid="quote-table-materials">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="border border-slate-300 px-3 py-2 font-semibold">Voce</th>
                    <th className="border border-slate-300 px-3 py-2 text-right font-semibold">Q.tà</th>
                    <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                      Prezzo
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                      Subtotale
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.voci_materiali.map((v) => (
                    <tr key={v.id}>
                      <td className="border border-slate-300 px-3 py-2">{v.nome}</td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                        {fmtNum(v.quantita)} {v.unita}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                        {fmtEuro(v.prezzo_unitario)}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                        {fmtEuro(v.subtotale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {p.voci_manodopera.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold uppercase tracking-wider text-slate-500">
                Manodopera
              </h3>
              <table className="mt-2 w-full border-collapse text-sm" data-testid="quote-table-labor">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="border border-slate-300 px-3 py-2 font-semibold">Descrizione</th>
                    <th className="border border-slate-300 px-3 py-2 text-right font-semibold">Ore</th>
                    <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                      Tariffa
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-right font-semibold">
                      Subtotale
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.voci_manodopera.map((v) => (
                    <tr key={v.id}>
                      <td className="border border-slate-300 px-3 py-2">{v.descrizione}</td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                        {fmtNum(v.ore)}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                        {fmtEuro(v.tariffa_oraria)}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                        {fmtEuro(v.subtotale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="mt-6 flex justify-end">
            <dl className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Imponibile</dt>
                <dd className="font-mono text-slate-900">{fmtEuro(p.totale_imponibile)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">IVA {p.aliquota_iva}%</dt>
                <dd className="font-mono text-slate-900">{fmtEuro(p.totale_iva)}</dd>
              </div>
              <div className="flex justify-between border-t-2 border-[#B45309] pt-2 text-base font-bold">
                <dt className="text-slate-900">Totale</dt>
                <dd className="font-mono text-[#B45309]" data-testid="quote-detail-total">
                  {fmtEuro(p.totale_preventivo)}
                </dd>
              </div>
            </dl>
          </div>

          {p.note_condizioni && (
            <div className="mt-6 rounded-lg bg-slate-100 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Condizioni e note
              </p>
              <p className="mt-1 text-sm text-slate-600">{p.note_condizioni}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
