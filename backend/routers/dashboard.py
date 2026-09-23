"""Router /api/dashboard — KPI e riepiloghi per la home."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from lib.dates import current_month_iso
from lib.db import db
from routers.lavori import Lavoro
from routers.materiali import Materiale
from routers.preventivi import Preventivo, con_scadenza

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class DashboardStats(BaseModel):
    lavori_da_iniziare: int
    lavori_in_corso: int
    lavori_completati: int
    preventivi_in_attesa: int
    valore_preventivi_attesa: float
    fatturato_completato: float
    valore_magazzino: float
    clienti_totali: int
    mese_corrente: str
    ore_mese: float
    valore_ore_mese: float
    tariffa_media_mese: float
    ore_mese_per_lavoro: list["OrePerLavoro"] = Field(default_factory=list)
    materiali_sotto_scorta: list[Materiale] = Field(default_factory=list)
    ultimi_lavori: list[Lavoro] = Field(default_factory=list)
    preventivi_recenti: list[Preventivo] = Field(default_factory=list)
    preventivi_scaduti: list[Preventivo] = Field(default_factory=list)


class OrePerLavoro(BaseModel):
    lavoro_id: str
    titolo: str
    cliente_nome: str
    ore: float
    valore: float


DashboardStats.model_rebuild()


@router.get("", response_model=DashboardStats)
async def statistiche():
    lavori_docs = await db.lavori.find().to_list(1000)
    materiali_docs = await db.materiali.find().to_list(1000)
    preventivi_docs = await db.preventivi.find().to_list(1000)
    clienti_totali = await db.clienti.count_documents({})

    lavori = [Lavoro(**d) for d in lavori_docs]
    materiali = sorted((Materiale(**d) for d in materiali_docs), key=lambda m: m.nome)
    preventivi = [Preventivo(**con_scadenza(d)) for d in preventivi_docs]

    sotto_scorta = sorted(
        (m for m in materiali if m.quantita_disponibile <= m.scorta_minima),
        key=lambda m: m.quantita_disponibile - m.scorta_minima,
    )

    # Riepilogo ore del mese corrente, ancorato alla data del server.
    mese = current_month_iso()
    ore_mese = 0.0
    valore_ore_mese = 0.0
    per_lavoro: list[OrePerLavoro] = []
    for lavoro in lavori:
        voci = [e for e in lavoro.ore_lavorate if e.data.startswith(mese)]
        if not voci:
            continue
        ore = round(sum(e.ore for e in voci), 2)
        valore = round(sum(e.ore * e.tariffa_oraria for e in voci), 2)
        ore_mese += ore
        valore_ore_mese += valore
        per_lavoro.append(
            OrePerLavoro(
                lavoro_id=lavoro.id,
                titolo=lavoro.titolo,
                cliente_nome=lavoro.cliente_nome,
                ore=ore,
                valore=valore,
            )
        )
    ore_mese = round(ore_mese, 2)
    valore_ore_mese = round(valore_ore_mese, 2)

    scaduti = sorted(
        (p for p in preventivi if p.scaduto),
        key=lambda p: p.data_scadenza,
    )

    return DashboardStats(
        lavori_da_iniziare=sum(1 for x in lavori if x.stato == "da_iniziare"),
        lavori_in_corso=sum(1 for x in lavori if x.stato == "in_corso"),
        lavori_completati=sum(1 for x in lavori if x.stato == "completato"),
        preventivi_in_attesa=sum(1 for p in preventivi if p.stato == "inviato"),
        valore_preventivi_attesa=round(
            sum(p.totale_preventivo for p in preventivi if p.stato == "inviato"), 2
        ),
        fatturato_completato=round(
            sum(x.prezzo_pattuito for x in lavori if x.stato == "completato"), 2
        ),
        valore_magazzino=round(
            sum(m.quantita_disponibile * m.prezzo_costo for m in materiali), 2
        ),
        clienti_totali=clienti_totali,
        mese_corrente=mese,
        ore_mese=ore_mese,
        valore_ore_mese=valore_ore_mese,
        tariffa_media_mese=round(valore_ore_mese / ore_mese, 2) if ore_mese else 0.0,
        ore_mese_per_lavoro=sorted(per_lavoro, key=lambda x: x.ore, reverse=True),
        materiali_sotto_scorta=sotto_scorta,
        ultimi_lavori=sorted(lavori, key=lambda x: x.created_at, reverse=True)[:5],
        preventivi_recenti=sorted(preventivi, key=lambda p: p.created_at, reverse=True)[:5],
        preventivi_scaduti=scaduti,
    )
