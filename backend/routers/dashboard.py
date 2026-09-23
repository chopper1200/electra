"""Router /api/dashboard — KPI e riepiloghi per la home."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from lib.db import db
from routers.lavori import Lavoro
from routers.materiali import Materiale
from routers.preventivi import Preventivo

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class DashboardStats(BaseModel):
    lavori_da_iniziare: int
    lavori_in_corso: int
    lavori_completati: int
    preventivi_in_attesa: int
    valore_preventivi_attesa: float
    fatturato_completato: float
    valore_magazzino: float
    materiali_sotto_scorta: list[Materiale] = Field(default_factory=list)
    ultimi_lavori: list[Lavoro] = Field(default_factory=list)
    preventivi_recenti: list[Preventivo] = Field(default_factory=list)


@router.get("", response_model=DashboardStats)
async def statistiche():
    lavori_docs = await db.lavori.find().to_list(1000)
    materiali_docs = await db.materiali.find().to_list(1000)
    preventivi_docs = await db.preventivi.find().to_list(1000)

    lavori = [Lavoro(**d) for d in lavori_docs]
    materiali = sorted((Materiale(**d) for d in materiali_docs), key=lambda m: m.nome)
    preventivi = [Preventivo(**d) for d in preventivi_docs]

    sotto_scorta = sorted(
        (m for m in materiali if m.quantita_disponibile <= m.scorta_minima),
        key=lambda m: m.quantita_disponibile - m.scorta_minima,
    )
    return DashboardStats(
        lavori_da_iniziare=sum(1 for l in lavori if l.stato == "da_iniziare"),
        lavori_in_corso=sum(1 for l in lavori if l.stato == "in_corso"),
        lavori_completati=sum(1 for l in lavori if l.stato == "completato"),
        preventivi_in_attesa=sum(1 for p in preventivi if p.stato == "inviato"),
        valore_preventivi_attesa=round(
            sum(p.totale_preventivo for p in preventivi if p.stato == "inviato"), 2
        ),
        fatturato_completato=round(
            sum(l.prezzo_pattuito for l in lavori if l.stato == "completato"), 2
        ),
        valore_magazzino=round(
            sum(m.quantita_disponibile * m.prezzo_costo for m in materiali), 2
        ),
        materiali_sotto_scorta=sotto_scorta,
        ultimi_lavori=sorted(lavori, key=lambda l: l.created_at, reverse=True)[:5],
        preventivi_recenti=sorted(preventivi, key=lambda p: p.created_at, reverse=True)[:5],
    )
