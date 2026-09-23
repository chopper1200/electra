"""Router /api/materiali — catalogo e magazzino."""

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from lib.db import db
from lib.listino import leggi_tabella, modello_xlsx, righe_normalizzate

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


class RisultatoImport(BaseModel):
    creati: int
    aggiornati: int
    ignorati: int
    totale_righe: int
    colonne_riconosciute: dict[str, str] = Field(default_factory=dict)
    avvisi: list[str] = Field(default_factory=list)
    anteprima: list[Materiale] = Field(default_factory=list)


ESTENSIONI_OK = (".xlsx", ".xlsm", ".csv")
MAX_BYTES = 5 * 1024 * 1024


@router.get("/import/modello")
async def scarica_modello():
    """Modello Excel con le intestazioni attese, da compilare e ricaricare."""
    return Response(
        content=modello_xlsx(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="modello-listino-voltcraft.xlsx"'},
    )


@router.post("/import", response_model=RisultatoImport)
async def importa_listino(
    file: UploadFile = File(...),
    aggiorna_esistenti: bool = Query(True, description="Aggiorna gli articoli già in catalogo"),
    azzera_giacenze: bool = Query(False, description="Ignora le giacenze del file e lascia 0"),
):
    """Popola il catalogo da un listino fornitore (Excel o CSV).

    Gli articoli sono riconosciuti dal codice articolo, oppure dal nome se il
    codice manca: così ricaricare un listino aggiornato non crea duplicati.
    """
    nome_file = file.filename or ""
    if not nome_file.lower().endswith(ESTENSIONI_OK):
        raise HTTPException(
            status_code=400,
            detail="Formato non supportato: carica un file .xlsx o .csv",
        )
    contenuto = await file.read()
    if not contenuto:
        raise HTTPException(status_code=400, detail="Il file è vuoto")
    if len(contenuto) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File troppo grande: massimo 5 MB")

    try:
        df = leggi_tabella(contenuto, nome_file)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Impossibile leggere il file: verifica che sia un Excel o CSV valido",
        )

    righe, avvisi, mappa = righe_normalizzate(df)
    if not righe:
        raise HTTPException(
            status_code=422,
            detail=avvisi[0] if avvisi else "Nessun articolo valido trovato nel file",
        )

    creati = aggiornati = ignorati = 0
    anteprima: list[Materiale] = []
    for riga in righe:
        if azzera_giacenze:
            riga["quantita_disponibile"] = 0.0
        query = (
            {"codice_art": riga["codice_art"]}
            if riga["codice_art"]
            else {"nome": {"$regex": f"^{re.escape(riga['nome'])}$", "$options": "i"}}
        )
        esistente = await db.materiali.find_one(query)
        if esistente:
            if not aggiorna_esistenti:
                ignorati += 1
                continue
            await db.materiali.update_one({"id": esistente["id"]}, {"$set": riga})
            aggiornati += 1
            if len(anteprima) < 5:
                anteprima.append(Materiale(**{**esistente, **riga}))
        else:
            materiale = Materiale(**riga)
            await db.materiali.insert_one(materiale.model_dump())
            creati += 1
            if len(anteprima) < 5:
                anteprima.append(materiale)

    return RisultatoImport(
        creati=creati,
        aggiornati=aggiornati,
        ignorati=ignorati,
        totale_righe=len(righe),
        colonne_riconosciute={campo: str(col) for campo, col in mappa.items()},
        avvisi=avvisi,
        anteprima=anteprima,
    )
