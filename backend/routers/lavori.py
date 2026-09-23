"""Router /api/lavori — gestione lavori elettrici."""

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from lib.db import db

router = APIRouter(prefix="/lavori", tags=["lavori"])

StatoLavoro = Literal["da_iniziare", "in_corso", "completato"]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MaterialUsage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    materiale_id: str = ""
    nome: str
    quantita: float
    unita: str = "pz"
    prezzo_unitario: float = 0.0


class Lavoro(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    titolo: str
    cliente_nome: str
    cliente_telefono: str = ""
    cliente_indirizzo: str = ""
    descrizione: str = ""
    stato: StatoLavoro = "da_iniziare"
    data_inizio: str = ""
    data_fine_prevista: str = ""
    prezzo_pattuito: float = 0.0
    ore_manodopera: float = 0.0
    note: str = ""
    materiali_usati: list[MaterialUsage] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)


class LavoroIn(BaseModel):
    titolo: str
    cliente_nome: str
    cliente_telefono: str = ""
    cliente_indirizzo: str = ""
    descrizione: str = ""
    stato: StatoLavoro = "da_iniziare"
    data_inizio: str = ""
    data_fine_prevista: str = ""
    prezzo_pattuito: float = 0.0
    ore_manodopera: float = 0.0
    note: str = ""


class StatoIn(BaseModel):
    stato: StatoLavoro


class UsageIn(BaseModel):
    materiale_id: str
    quantita: float


async def _get_lavoro(lavoro_id: str) -> dict:
    doc = await db.lavori.find_one({"id": lavoro_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Lavoro non trovato")
    return doc


@router.get("", response_model=list[Lavoro])
async def lista_lavori(stato: StatoLavoro | None = None):
    query = {"stato": stato} if stato else {}
    docs = await db.lavori.find(query).sort("created_at", -1).to_list(1000)
    return [Lavoro(**d) for d in docs]


@router.post("", response_model=Lavoro, status_code=201)
async def crea_lavoro(input: LavoroIn):
    lavoro = Lavoro(**input.model_dump())
    await db.lavori.insert_one(lavoro.model_dump())
    return lavoro


@router.get("/{lavoro_id}", response_model=Lavoro)
async def dettaglio_lavoro(lavoro_id: str):
    return Lavoro(**await _get_lavoro(lavoro_id))


@router.put("/{lavoro_id}", response_model=Lavoro)
async def aggiorna_lavoro(lavoro_id: str, input: LavoroIn):
    doc = await db.lavori.find_one_and_update(
        {"id": lavoro_id}, {"$set": input.model_dump()}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Lavoro non trovato")
    return Lavoro(**doc)


@router.patch("/{lavoro_id}/stato", response_model=Lavoro)
async def cambia_stato(lavoro_id: str, input: StatoIn):
    doc = await db.lavori.find_one_and_update(
        {"id": lavoro_id}, {"$set": {"stato": input.stato}}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Lavoro non trovato")
    return Lavoro(**doc)


@router.post("/{lavoro_id}/materiali", response_model=Lavoro)
async def registra_materiale(lavoro_id: str, input: UsageIn):
    await _get_lavoro(lavoro_id)
    materiale = await db.materiali.find_one({"id": input.materiale_id})
    if not materiale:
        raise HTTPException(status_code=404, detail="Materiale non trovato")
    quantita = round(input.quantita, 2)
    if quantita <= 0:
        raise HTTPException(status_code=422, detail="La quantità deve essere maggiore di zero")
    usage = MaterialUsage(
        materiale_id=input.materiale_id,
        nome=materiale["nome"],
        quantita=quantita,
        unita=materiale.get("unita_misura", "pz"),
        prezzo_unitario=materiale.get("prezzo_unitario", 0.0),
    )
    doc = await db.lavori.find_one_and_update(
        {"id": lavoro_id},
        {"$push": {"materiali_usati": usage.model_dump()}},
        return_document=True,
    )
    await db.materiali.update_one(
        {"id": input.materiale_id}, {"$inc": {"quantita_disponibile": -quantita}}
    )
    return Lavoro(**doc)


@router.delete("/{lavoro_id}/materiali/{usage_id}", response_model=Lavoro)
async def elimina_materiale_usato(lavoro_id: str, usage_id: str):
    doc = await _get_lavoro(lavoro_id)
    usage = next((u for u in doc.get("materiali_usati", []) if u.get("id") == usage_id), None)
    if not usage:
        raise HTTPException(status_code=404, detail="Voce non trovata")
    updated = await db.lavori.find_one_and_update(
        {"id": lavoro_id},
        {"$pull": {"materiali_usati": {"id": usage_id}}},
        return_document=True,
    )
    await db.materiali.update_one(
        {"id": usage["materiale_id"]}, {"$inc": {"quantita_disponibile": usage["quantita"]}}
    )
    return Lavoro(**updated)


@router.delete("/{lavoro_id}", status_code=204)
async def elimina_lavoro(lavoro_id: str):
    res = await db.lavori.delete_one({"id": lavoro_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lavoro non trovato")
