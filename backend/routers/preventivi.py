"""Router /api/preventivi — preventivi con voci materiale, manodopera, IVA e sconto."""

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from lib.dates import today_iso
from lib.db import db
from routers.lavori import Lavoro, MaterialUsage

router = APIRouter(prefix="/preventivi", tags=["preventivi"])

StatoPreventivo = Literal["bozza", "inviato", "accettato", "rifiutato"]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class VoceMateriale(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    materiale_id: str = ""
    nome: str
    quantita: float
    unita: str = "pz"
    prezzo_unitario: float = 0.0
    subtotale: float = 0.0


class VoceManodopera(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    descrizione: str
    ore: float
    tariffa_oraria: float
    subtotale: float = 0.0


class Preventivo(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    numero: str
    data_emissione: str
    validita_giorni: int = 30
    cliente_nome: str
    cliente_telefono: str = ""
    cliente_email: str = ""
    cliente_indirizzo: str = ""
    cliente_piva: str = ""
    titolo_intervento: str
    voci_materiali: list[VoceMateriale] = Field(default_factory=list)
    voci_manodopera: list[VoceManodopera] = Field(default_factory=list)
    sconto_percentuale: float = 0.0
    aliquota_iva: float = 22.0
    totale_imponibile: float = 0.0
    totale_iva: float = 0.0
    totale_preventivo: float = 0.0
    stato: StatoPreventivo = "bozza"
    note_condizioni: str = ""
    lavoro_id: str = ""
    created_at: datetime = Field(default_factory=utc_now)


class VoceMaterialeIn(BaseModel):
    materiale_id: str = ""
    nome: str
    quantita: float
    unita: str = "pz"
    prezzo_unitario: float = 0.0


class VoceManodoperaIn(BaseModel):
    descrizione: str
    ore: float
    tariffa_oraria: float


class PreventivoIn(BaseModel):
    cliente_nome: str
    cliente_telefono: str = ""
    cliente_email: str = ""
    cliente_indirizzo: str = ""
    cliente_piva: str = ""
    titolo_intervento: str
    data_emissione: str = ""
    validita_giorni: int = 30
    voci_materiali: list[VoceMaterialeIn] = Field(default_factory=list)
    voci_manodopera: list[VoceManodoperaIn] = Field(default_factory=list)
    sconto_percentuale: float = 0.0
    aliquota_iva: float = 22.0
    note_condizioni: str = ""


class StatoIn(BaseModel):
    stato: StatoPreventivo


def _build_doc(input: PreventivoIn, *, numero: str, base: dict | None = None) -> dict:
    voci_mat = [
        VoceMateriale(
            materiale_id=v.materiale_id,
            nome=v.nome,
            quantita=round(v.quantita, 2),
            unita=v.unita,
            prezzo_unitario=v.prezzo_unitario,
            subtotale=round(v.quantita * v.prezzo_unitario, 2),
        )
        for v in input.voci_materiali
    ]
    voci_man = [
        VoceManodopera(
            descrizione=v.descrizione,
            ore=round(v.ore, 2),
            tariffa_oraria=v.tariffa_oraria,
            subtotale=round(v.ore * v.tariffa_oraria, 2),
        )
        for v in input.voci_manodopera
    ]
    lordo = round(
        sum(v.subtotale for v in voci_mat) + sum(v.subtotale for v in voci_man), 2
    )
    sconto_importo = round(lordo * input.sconto_percentuale / 100, 2)
    imponibile = round(lordo - sconto_importo, 2)
    iva = round(imponibile * input.aliquota_iva / 100, 2)
    totale = round(imponibile + iva, 2)
    doc: dict = {
        "numero": numero,
        "data_emissione": input.data_emissione or today_iso(),
        "validita_giorni": input.validita_giorni,
        "cliente_nome": input.cliente_nome,
        "cliente_telefono": input.cliente_telefono,
        "cliente_email": input.cliente_email,
        "cliente_indirizzo": input.cliente_indirizzo,
        "cliente_piva": input.cliente_piva,
        "titolo_intervento": input.titolo_intervento,
        "voci_materiali": [v.model_dump() for v in voci_mat],
        "voci_manodopera": [v.model_dump() for v in voci_man],
        "sconto_percentuale": input.sconto_percentuale,
        "aliquota_iva": input.aliquota_iva,
        "totale_imponibile": imponibile,
        "totale_iva": iva,
        "totale_preventivo": totale,
        "note_condizioni": input.note_condizioni,
    }
    if base:
        doc["id"] = base["id"]
        doc["created_at"] = base["created_at"]
        doc["stato"] = base["stato"]
        doc["lavoro_id"] = base.get("lavoro_id", "")
    return doc


async def _get_preventivo(preventivo_id: str) -> dict:
    doc = await db.preventivi.find_one({"id": preventivo_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")
    return doc


async def _next_numero() -> str:
    year = today_iso()[:4]
    prefix = f"P-{year}-"
    docs = await db.preventivi.find({}, {"numero": 1}).to_list(5000)
    seqs = [
        int(d["numero"].split("-")[-1])
        for d in docs
        if str(d.get("numero", "")).startswith(prefix)
    ]
    return f"{prefix}{max(seqs, default=0) + 1:04d}"


@router.get("", response_model=list[Preventivo])
async def lista_preventivi():
    docs = await db.preventivi.find().sort("created_at", -1).to_list(1000)
    return [Preventivo(**d) for d in docs]


@router.post("", response_model=Preventivo, status_code=201)
async def crea_preventivo(input: PreventivoIn):
    numero = await _next_numero()
    preventivo = Preventivo(**_build_doc(input, numero=numero))
    await db.preventivi.insert_one(preventivo.model_dump())
    return preventivo


@router.get("/{preventivo_id}", response_model=Preventivo)
async def dettaglio_preventivo(preventivo_id: str):
    return Preventivo(**await _get_preventivo(preventivo_id))


@router.put("/{preventivo_id}", response_model=Preventivo)
async def aggiorna_preventivo(preventivo_id: str, input: PreventivoIn):
    base = await _get_preventivo(preventivo_id)
    if base.get("lavoro_id"):
        raise HTTPException(
            status_code=400, detail="Il preventivo è già stato convertito in lavoro"
        )
    doc = _build_doc(input, numero=base["numero"], base=base)
    await db.preventivi.update_one({"id": preventivo_id}, {"$set": doc})
    return Preventivo(**{**base, **doc})


@router.patch("/{preventivo_id}/stato", response_model=Preventivo)
async def cambia_stato(preventivo_id: str, input: StatoIn):
    doc = await db.preventivi.find_one_and_update(
        {"id": preventivo_id}, {"$set": {"stato": input.stato}}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")
    return Preventivo(**doc)


@router.post("/{preventivo_id}/duplica", response_model=Preventivo, status_code=201)
async def duplica_preventivo(preventivo_id: str):
    base = await _get_preventivo(preventivo_id)
    numero = await _next_numero()
    nuovo = {k: v for k, v in base.items() if k != "_id"}
    nuovo["id"] = str(uuid.uuid4())
    nuovo["numero"] = numero
    nuovo["data_emissione"] = today_iso()
    nuovo["stato"] = "bozza"
    nuovo["lavoro_id"] = ""
    nuovo["created_at"] = utc_now()
    await db.preventivi.insert_one(nuovo)
    return Preventivo(**nuovo)


@router.post("/{preventivo_id}/converti", response_model=Lavoro, status_code=201)
async def converti_in_lavoro(preventivo_id: str):
    base = await _get_preventivo(preventivo_id)
    if base.get("stato") != "accettato":
        raise HTTPException(
            status_code=400,
            detail="Solo un preventivo accettato può essere convertito in lavoro",
        )
    if base.get("lavoro_id"):
        raise HTTPException(
            status_code=400, detail="Preventivo già convertito in lavoro"
        )
    materiali_usati = [
        MaterialUsage(
            materiale_id=v.get("materiale_id", ""),
            nome=v["nome"],
            quantita=v["quantita"],
            unita=v.get("unita", "pz"),
            prezzo_unitario=v.get("prezzo_unitario", 0.0),
        )
        for v in base.get("voci_materiali", [])
    ]
    lavoro = Lavoro(
        titolo=f"{base['titolo_intervento']} (da {base['numero']})",
        cliente_nome=base["cliente_nome"],
        cliente_telefono=base.get("cliente_telefono", ""),
        cliente_indirizzo=base.get("cliente_indirizzo", ""),
        descrizione=base.get("note_condizioni", ""),
        stato="da_iniziare",
        prezzo_pattuito=base.get("totale_preventivo", 0.0),
        materiali_usati=materiali_usati,
    )
    await db.lavori.insert_one(lavoro.model_dump())
    await db.preventivi.update_one(
        {"id": preventivo_id}, {"$set": {"lavoro_id": lavoro.id}}
    )
    return lavoro


@router.delete("/{preventivo_id}", status_code=204)
async def elimina_preventivo(preventivo_id: str):
    res = await db.preventivi.delete_one({"id": preventivo_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")
