"""Router /api/materiali — catalogo e magazzino."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from lib.db import db

router = APIRouter(prefix="/materiali", tags=["materiali"])

CATEGORIE = [
    "Cavi e Conduttori",
    "Magnetotermici e Quadri",
    "Prese e Interruttori",
    "Tubi e Canaline",
    "Illuminazione",
    "Minuteria e Fissaggi",
]

UNITA_MISURA = ["pz", "m", "conf", "rotolo"]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Materiale(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    codice_art: str = ""
    nome: str
    categoria: str
    unita_misura: str = "pz"
    prezzo_unitario: float = 0.0
    prezzo_costo: float = 0.0
    quantita_disponibile: float = 0.0
    scorta_minima: float = 0.0
    fornitore: str = ""
    created_at: datetime = Field(default_factory=utc_now)


class MaterialeIn(BaseModel):
    codice_art: str = ""
    nome: str
    categoria: str
    unita_misura: str = "pz"
    prezzo_unitario: float = 0.0
    prezzo_costo: float = 0.0
    quantita_disponibile: float = 0.0
    scorta_minima: float = 0.0
    fornitore: str = ""


class StockAdjustIn(BaseModel):
    delta: float


async def _get_materiale(materiale_id: str) -> dict:
    doc = await db.materiali.find_one({"id": materiale_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Materiale non trovato")
    return doc


@router.get("", response_model=list[Materiale])
async def lista_materiali():
    docs = await db.materiali.find().sort("nome", 1).to_list(1000)
    return [Materiale(**d) for d in docs]


@router.post("", response_model=Materiale, status_code=201)
async def crea_materiale(input: MaterialeIn):
    materiale = Materiale(**input.model_dump())
    await db.materiali.insert_one(materiale.model_dump())
    return materiale


@router.put("/{materiale_id}", response_model=Materiale)
async def aggiorna_materiale(materiale_id: str, input: MaterialeIn):
    doc = await db.materiali.find_one_and_update(
        {"id": materiale_id}, {"$set": input.model_dump()}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Materiale non trovato")
    return Materiale(**doc)


@router.patch("/{materiale_id}/stock", response_model=Materiale)
async def aggiorna_stock(materiale_id: str, input: StockAdjustIn):
    doc = await db.materiali.find_one_and_update(
        {"id": materiale_id},
        {"$inc": {"quantita_disponibile": round(input.delta, 2)}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Materiale non trovato")
    return Materiale(**doc)


@router.delete("/{materiale_id}", status_code=204)
async def elimina_materiale(materiale_id: str):
    res = await db.materiali.delete_one({"id": materiale_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Materiale non trovato")
