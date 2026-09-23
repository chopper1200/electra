"""Router /api/preventivi — preventivi con voci materiale, manodopera, IVA e sconto."""

import uuid
from datetime import datetime, timezone
from html import escape
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from lib.dates import aggiungi_giorni, giorni_tra, today_iso
from lib.db import db
from lib.email import EMAIL_FROM_NAME, send_email
from routers.clienti import upsert_cliente
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
    lavoro_id: str = ""
    ore_entry_id: str = ""


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
    data_scadenza: str = ""
    giorni_alla_scadenza: int = 0
    scaduto: bool = False
    email_inviata_a: str = ""
    data_invio_email: str = ""
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
    lavoro_id: str = ""
    ore_entry_id: str = ""


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


def con_scadenza(doc: dict) -> dict:
    """Arricchisce il documento con i campi di scadenza calcolati sulla data del server.

    Un preventivo è «scaduto» solo se è stato inviato e il cliente non ha ancora
    risposto: bozze, accettati e rifiutati non richiedono follow-up.
    """
    emissione = str(doc.get("data_emissione") or "")[:10]
    validita = int(doc.get("validita_giorni") or 0)
    if not emissione:
        return {**doc, "data_scadenza": "", "giorni_alla_scadenza": 0, "scaduto": False}
    scadenza = aggiungi_giorni(emissione, validita)
    residui = giorni_tra(today_iso(), scadenza)
    return {
        **doc,
        "data_scadenza": scadenza,
        "giorni_alla_scadenza": residui,
        "scaduto": doc.get("stato") == "inviato" and residui < 0,
    }


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
            lavoro_id=v.lavoro_id,
            ore_entry_id=v.ore_entry_id,
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


async def _sync_ore_lavorate(preventivo_id: str, voci_man: list[dict]) -> None:
    """Allinea il contrassegno preventivo_id sulle ore tracciate dei lavori.

    Le ore referenziate dalle voci manodopera del preventivo vengono marcate con
    il suo id; le ore prima marcate con questo preventivo e assenti dalle voci
    tornano disponibili per una nuova importazione.
    """
    attesi = {v["ore_entry_id"] for v in voci_man if v.get("ore_entry_id")}
    lavori = await db.lavori.find({"ore_lavorate.0": {"$exists": True}}).to_list(1000)
    for l in lavori:
        nuove = []
        cambiato = False
        for e in l.get("ore_lavorate", []):
            if e["id"] in attesi:
                cambiato = cambiato or e.get("preventivo_id", "") != preventivo_id
                e["preventivo_id"] = preventivo_id
            elif e.get("preventivo_id", "") == preventivo_id:
                cambiato = True
                e["preventivo_id"] = ""
            nuove.append(e)
        if cambiato:
            await db.lavori.update_one({"id": l["id"]}, {"$set": {"ore_lavorate": nuove}})


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
    return [Preventivo(**con_scadenza(d)) for d in docs]


@router.post("", response_model=Preventivo, status_code=201)
async def crea_preventivo(input: PreventivoIn):
    numero = await _next_numero()
    preventivo = Preventivo(**con_scadenza(_build_doc(input, numero=numero)))
    doc = preventivo.model_dump()
    await db.preventivi.insert_one(doc)
    await _sync_ore_lavorate(preventivo.id, doc["voci_manodopera"])
    await upsert_cliente(
        input.cliente_nome,
        telefono=input.cliente_telefono,
        email=input.cliente_email,
        indirizzo=input.cliente_indirizzo,
        piva=input.cliente_piva,
    )
    return preventivo


@router.get("/{preventivo_id}", response_model=Preventivo)
async def dettaglio_preventivo(preventivo_id: str):
    return Preventivo(**con_scadenza(await _get_preventivo(preventivo_id)))


@router.put("/{preventivo_id}", response_model=Preventivo)
async def aggiorna_preventivo(preventivo_id: str, input: PreventivoIn):
    base = await _get_preventivo(preventivo_id)
    if base.get("lavoro_id"):
        raise HTTPException(
            status_code=400, detail="Il preventivo è già stato convertito in lavoro"
        )
    doc = _build_doc(input, numero=base["numero"], base=base)
    await db.preventivi.update_one({"id": preventivo_id}, {"$set": doc})
    await _sync_ore_lavorate(preventivo_id, doc["voci_manodopera"])
    await upsert_cliente(
        input.cliente_nome,
        telefono=input.cliente_telefono,
        email=input.cliente_email,
        indirizzo=input.cliente_indirizzo,
        piva=input.cliente_piva,
    )
    return Preventivo(**con_scadenza({**base, **doc}))


@router.patch("/{preventivo_id}/stato", response_model=Preventivo)
async def cambia_stato(preventivo_id: str, input: StatoIn):
    doc = await db.preventivi.find_one_and_update(
        {"id": preventivo_id}, {"$set": {"stato": input.stato}}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")
    return Preventivo(**con_scadenza(doc))


class RinnovoIn(BaseModel):
    validita_giorni: int = 30


@router.patch("/{preventivo_id}/rinnova", response_model=Preventivo)
async def rinnova_validita(preventivo_id: str, input: RinnovoIn):
    """Follow-up di un preventivo scaduto: ri-emette da oggi con nuova validità."""
    await _get_preventivo(preventivo_id)
    giorni = input.validita_giorni if input.validita_giorni > 0 else 30
    doc = await db.preventivi.find_one_and_update(
        {"id": preventivo_id},
        {"$set": {"data_emissione": today_iso(), "validita_giorni": giorni, "stato": "inviato"}},
        return_document=True,
    )
    return Preventivo(**con_scadenza(doc))


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
    # il duplicato è una bozza nuova: le voci manodopera perdono il legame con le ore tracciate
    nuovo["voci_manodopera"] = [
        {k: v for k, v in voce.items() if k not in ("lavoro_id", "ore_entry_id")}
        for voce in base.get("voci_manodopera", [])
    ]
    await db.preventivi.insert_one(nuovo)
    return Preventivo(**con_scadenza(nuovo))


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
    await _get_preventivo(preventivo_id)
    await _sync_ore_lavorate(preventivo_id, [])
    res = await db.preventivi.delete_one({"id": preventivo_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")


def _euro(valore: float) -> str:
    """Formatta un importo in stile italiano: 1.234,56 €."""
    intero, _, dec = f"{valore:,.2f}".partition(".")
    return f"{intero.replace(',', '.')},{dec} €"


def _data_it(iso: str) -> str:
    parti = str(iso or "")[:10].split("-")
    return f"{parti[2]}/{parti[1]}/{parti[0]}" if len(parti) == 3 else "—"


def _righe_html(doc: dict) -> str:
    """Tabella delle voci: costruita lato server, tutti i valori escapati (G4)."""
    righe = []
    for v in doc.get("voci_materiali", []):
        quantita = escape(f"{v['quantita']:g} {v.get('unita', 'pz')}")
        righe.append(
            "<tr>"
            f'<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">'
            f'{escape(str(v["nome"]))}</td>'
            f'<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right">'
            f"{quantita}</td>"
            f'<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right">'
            f'{escape(_euro(v["subtotale"]))}</td>'
            "</tr>"
        )
    for v in doc.get("voci_manodopera", []):
        ore = escape(f"{v['ore']:g} h")
        righe.append(
            "<tr>"
            f'<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0">'
            f'{escape(str(v["descrizione"]))}</td>'
            f'<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right">'
            f"{ore}</td>"
            f'<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right">'
            f'{escape(_euro(v["subtotale"]))}</td>'
            "</tr>"
        )
    return "".join(righe)


def _corpo_email(doc: dict) -> str:
    """Template server-side del preventivo: nessun HTML arriva dal client."""
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#f1f5f9;padding:24px 0"><tr><td align="center">'
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" '
        'style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;'
        'font-family:Arial,Helvetica,sans-serif;color:#0f172a">'
        '<tr><td style="background:#0b0f17;padding:20px 24px">'
        f'<div style="font-size:18px;font-weight:bold;color:#f59e0b">{escape(EMAIL_FROM_NAME)}</div>'
        '<div style="font-size:12px;color:#94a3b8;margin-top:2px">'
        "Impianti elettrici · Manutenzione · Certificazioni</div>"
        "</td></tr>"
        '<tr><td style="padding:24px">'
        f'<p style="margin:0 0 12px">Gentile {escape(str(doc["cliente_nome"]))},</p>'
        '<p style="margin:0 0 16px">in allegato al presente messaggio trova il riepilogo del '
        "preventivo richiesto. Resto a disposizione per qualsiasi chiarimento.</p>"
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#f8fafc;border-radius:8px;margin:0 0 16px">'
        f'<tr><td style="padding:12px 14px;font-size:14px">'
        f'<strong>Preventivo {escape(str(doc["numero"]))}</strong><br>'
        f'{escape(str(doc["titolo_intervento"]))}<br>'
        f'<span style="color:#64748b">Emissione {escape(_data_it(doc.get("data_emissione", "")))} · '
        f'Validità {escape(str(doc.get("validita_giorni", 30)))} giorni</span>'
        "</td></tr></table>"
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="font-size:14px;border-collapse:collapse">'
        '<tr style="background:#f1f5f9">'
        '<th align="left" style="padding:8px 10px">Voce</th>'
        '<th align="right" style="padding:8px 10px">Q.tà</th>'
        '<th align="right" style="padding:8px 10px">Importo</th></tr>'
        f"{_righe_html(doc)}"
        "</table>"
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="font-size:14px;margin-top:16px">'
        f'<tr><td align="right" style="padding:3px 10px;color:#64748b">Imponibile</td>'
        f'<td align="right" style="padding:3px 10px;width:120px">'
        f'{escape(_euro(doc.get("totale_imponibile", 0)))}</td></tr>'
        f'<tr><td align="right" style="padding:3px 10px;color:#64748b">'
        f'IVA {escape(str(doc.get("aliquota_iva", 22)))}%</td>'
        f'<td align="right" style="padding:3px 10px">{escape(_euro(doc.get("totale_iva", 0)))}</td></tr>'
        f'<tr><td align="right" style="padding:8px 10px;font-weight:bold;border-top:2px solid #b45309">'
        f'Totale</td><td align="right" style="padding:8px 10px;font-weight:bold;'
        f'border-top:2px solid #b45309;color:#b45309">'
        f'{escape(_euro(doc.get("totale_preventivo", 0)))}</td></tr>'
        "</table>"
        + (
            f'<p style="margin:18px 0 0;font-size:13px;color:#475569">'
            f'{escape(str(doc.get("note_condizioni", "")))}</p>'
            if doc.get("note_condizioni")
            else ""
        )
        + "</td></tr>"
        '<tr><td style="padding:16px 24px;background:#f8fafc;font-size:12px;color:#64748b">'
        f"Messaggio inviato da {escape(EMAIL_FROM_NAME)}. Per rispondere o modificare il "
        "preventivo può contattarci ai riferimenti che le abbiamo fornito."
        "</td></tr></table></td></tr></table>"
    )


@router.post("/{preventivo_id}/invia", response_model=Preventivo)
async def invia_per_email(preventivo_id: str):
    """Invia il preventivo al cliente.

    Il destinatario è letto dal documento salvato e il corpo deriva da un template
    server-side: il chiamante passa solo l'id, mai indirizzi o HTML.
    """
    doc = await _get_preventivo(preventivo_id)
    destinatario = str(doc.get("cliente_email") or "").strip()
    if not destinatario or "@" not in destinatario:
        raise HTTPException(
            status_code=400,
            detail="Il cliente non ha un indirizzo email: aggiungilo al preventivo e riprova",
        )
    await send_email(
        to=destinatario,
        subject=f"Preventivo {doc['numero']} — {doc['titolo_intervento']}",
        html=_corpo_email(doc),
    )
    aggiornato = await db.preventivi.find_one_and_update(
        {"id": preventivo_id},
        {
            "$set": {
                "stato": "inviato",
                "email_inviata_a": destinatario,
                "data_invio_email": today_iso(),
                "data_emissione": doc.get("data_emissione") or today_iso(),
            }
        },
        return_document=True,
    )
    return Preventivo(**con_scadenza(aggiornato))
