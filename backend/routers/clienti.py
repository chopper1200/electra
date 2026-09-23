"""Router /api/clienti — anagrafica clienti riutilizzabile in lavori e preventivi."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from lib.db import db

router = APIRouter(prefix="/clienti", tags=["clienti"])


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Cliente(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    telefono: str = ""
    email: str = ""
    indirizzo: str = ""
    piva: str = ""
    note: str = ""
    created_at: datetime = Field(default_factory=utc_now)


class ClienteIn(BaseModel):
    nome: str
    telefono: str = ""
    email: str = ""
    indirizzo: str = ""
    piva: str = ""
    note: str = ""


async def upsert_cliente(
    nome: str,
    *,
    telefono: str = "",
    email: str = "",
    indirizzo: str = "",
    piva: str = "",
) -> None:
    """Salva il cliente in anagrafica la prima volta che compare in un lavoro o preventivo.

    Se esiste già (match sul nome, case-insensitive) completa solo i campi ancora vuoti,
    così i dati inseriti a mano dall'utente non vengono sovrascritti.
    """
    nome = nome.strip()
    if not nome:
        return
    esistente = await db.clienti.find_one({"nome": {"$regex": f"^{nome}$", "$options": "i"}})
    if not esistente:
        cliente = Cliente(
            nome=nome, telefono=telefono, email=email, indirizzo=indirizzo, piva=piva
        )
        await db.clienti.insert_one(cliente.model_dump())
        return
    patch = {
        campo: valore
        for campo, valore in (
            ("telefono", telefono),
            ("email", email),
            ("indirizzo", indirizzo),
            ("piva", piva),
        )
        if valore and not esistente.get(campo)
    }
    if patch:
        await db.clienti.update_one({"id": esistente["id"]}, {"$set": patch})


@router.get("", response_model=list[Cliente])
async def lista_clienti():
    docs = await db.clienti.find().sort("nome", 1).to_list(1000)
    return [Cliente(**d) for d in docs]


@router.post("", response_model=Cliente, status_code=201)
async def crea_cliente(input: ClienteIn):
    nome = input.nome.strip()
    if not nome:
        raise HTTPException(status_code=422, detail="Il nome del cliente è obbligatorio")
    esistente = await db.clienti.find_one({"nome": {"$regex": f"^{nome}$", "$options": "i"}})
    if esistente:
        raise HTTPException(status_code=409, detail="Esiste già un cliente con questo nome")
    cliente = Cliente(**{**input.model_dump(), "nome": nome})
    await db.clienti.insert_one(cliente.model_dump())
    return cliente


@router.put("/{cliente_id}", response_model=Cliente)
async def aggiorna_cliente(cliente_id: str, input: ClienteIn):
    doc = await db.clienti.find_one_and_update(
        {"id": cliente_id},
        {"$set": {**input.model_dump(), "nome": input.nome.strip()}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    return Cliente(**doc)


@router.delete("/{cliente_id}", status_code=204)
async def elimina_cliente(cliente_id: str):
    res = await db.clienti.delete_one({"id": cliente_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
