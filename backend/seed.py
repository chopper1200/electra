"""Seed idempotente con dati realistici da elettricista.

Esecuzione: cd /app/backend && python seed.py
Non è importato da server.py; se le collezioni hanno già dati non fa nulla.
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from lib.dates import today_iso
from lib.db import db, ensure_indexes

MATERIALI = [
    {"codice_art": "FS18-3G25", "nome": "Cavo FS18 3G2,5", "categoria": "Cavi e Conduttori", "unita_misura": "m", "prezzo_unitario": 1.20, "prezzo_costo": 0.75, "quantita_disponibile": 250, "scorta_minima": 100, "fornitore": "Gewiss"},
    {"codice_art": "FG16OR-3G15", "nome": "Cavo FG16OR 3G1,5", "categoria": "Cavi e Conduttori", "unita_misura": "m", "prezzo_unitario": 0.95, "prezzo_costo": 0.58, "quantita_disponibile": 300, "scorta_minima": 100, "fornitore": "Gewiss"},
    {"codice_art": "N07VK-25", "nome": "Cavo unipolare N07V-K 2,5 mm²", "categoria": "Cavi e Conduttori", "unita_misura": "m", "prezzo_unitario": 0.45, "prezzo_costo": 0.25, "quantita_disponibile": 180, "scorta_minima": 150, "fornitore": "Prysmian"},
    {"codice_art": "GW-25A-30MA", "nome": "Differenziale bipolare 25A 30mA", "categoria": "Magnetotermici e Quadri", "unita_misura": "pz", "prezzo_unitario": 28.50, "prezzo_costo": 17.90, "quantita_disponibile": 4, "scorta_minima": 5, "fornitore": "Gewiss"},
    {"codice_art": "MT-16A-C", "nome": "Magnetotermico bipolare 16A curva C", "categoria": "Magnetotermici e Quadri", "unita_misura": "pz", "prezzo_unitario": 12.40, "prezzo_costo": 7.60, "quantita_disponibile": 12, "scorta_minima": 6, "fornitore": "ABB"},
    {"codice_art": "QEO-24M", "nome": "Quadro elettrico 24 moduli", "categoria": "Magnetotermici e Quadri", "unita_misura": "pz", "prezzo_unitario": 46.00, "prezzo_costo": 29.00, "quantita_disponibile": 3, "scorta_minima": 2, "fornitore": "Gewiss"},
    {"codice_art": "LN-26602", "nome": "Presa bipasso BTicino Living Now", "categoria": "Prese e Interruttori", "unita_misura": "pz", "prezzo_unitario": 9.80, "prezzo_costo": 5.90, "quantita_disponibile": 24, "scorta_minima": 10, "fornitore": "BTicino"},
    {"codice_art": "LN-26001", "nome": "Interruttore unipolare BTicino Living Now", "categoria": "Prese e Interruttori", "unita_misura": "pz", "prezzo_unitario": 8.60, "prezzo_costo": 5.20, "quantita_disponibile": 15, "scorta_minima": 10, "fornitore": "BTicino"},
    {"codice_art": "LN-27301", "nome": "Presa USB A+C BTicino Living Now", "categoria": "Prese e Interruttori", "unita_misura": "pz", "prezzo_unitario": 24.00, "prezzo_costo": 15.50, "quantita_disponibile": 6, "scorta_minima": 4, "fornitore": "BTicino"},
    {"codice_art": "CORR-D20", "nome": "Tubo corrugato Ø20", "categoria": "Tubi e Canaline", "unita_misura": "m", "prezzo_unitario": 0.65, "prezzo_costo": 0.38, "quantita_disponibile": 60, "scorta_minima": 80, "fornitore": "Cormano"},
    {"codice_art": "CAN-4025", "nome": "Canalina 40x25 bianca", "categoria": "Tubi e Canaline", "unita_misura": "m", "prezzo_unitario": 3.20, "prezzo_costo": 1.95, "quantita_disponibile": 40, "scorta_minima": 20, "fornitore": "Cormano"},
    {"codice_art": "PSC-D20", "nome": "Pressacavo Ø20", "categoria": "Tubi e Canaline", "unita_misura": "pz", "prezzo_unitario": 0.30, "prezzo_costo": 0.12, "quantita_disponibile": 150, "scorta_minima": 50, "fornitore": "Illuminart"},
    {"codice_art": "FAR-LED7", "nome": "Faretto LED 7W orientabile", "categoria": "Illuminazione", "unita_misura": "pz", "prezzo_unitario": 14.50, "prezzo_costo": 8.90, "quantita_disponibile": 18, "scorta_minima": 8, "fornitore": "Illuminart"},
    {"codice_art": "PAN-6060", "nome": "Pannello LED 60x60 40W", "categoria": "Illuminazione", "unita_misura": "pz", "prezzo_unitario": 22.00, "prezzo_costo": 13.80, "quantita_disponibile": 2, "scorta_minima": 4, "fornitore": "Illuminart"},
    {"codice_art": "LED-E27-85", "nome": "Lampadina LED E27 8,5W", "categoria": "Illuminazione", "unita_misura": "pz", "prezzo_unitario": 3.50, "prezzo_costo": 1.80, "quantita_disponibile": 30, "scorta_minima": 12, "fornitore": "Illuminart"},
    {"codice_art": "FAS-48", "nome": "Fascette stringitubo 4,8 mm", "categoria": "Minuteria e Fissaggi", "unita_misura": "conf", "prezzo_unitario": 4.90, "prezzo_costo": 2.70, "quantita_disponibile": 10, "scorta_minima": 4, "fornitore": "Gewiss"},
    {"codice_art": "MOR-2P", "nome": "Morsetti rapidi 2 poli", "categoria": "Minuteria e Fissaggi", "unita_misura": "conf", "prezzo_unitario": 6.40, "prezzo_costo": 3.60, "quantita_disponibile": 8, "scorta_minima": 3, "fornitore": "Wago"},
    {"codice_art": "CAP-CH", "nome": "Capochiavi assemblati", "categoria": "Minuteria e Fissaggi", "unita_misura": "conf", "prezzo_unitario": 5.20, "prezzo_costo": 3.10, "quantita_disponibile": 0, "scorta_minima": 3, "fornitore": "Gewiss"},
]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def giorni_fa(n: int) -> str:
    return (utc_now() - timedelta(days=n)).strftime("%Y-%m-%d")


def crea_voce_materiale(mat: dict, quantita: float) -> dict:
    subtotale = round(quantita * mat["prezzo_unitario"], 2)
    return {
        "id": str(uuid.uuid4()),
        "materiale_id": mat["id"],
        "nome": mat["nome"],
        "quantita": quantita,
        "unita": mat["unita_misura"],
        "prezzo_unitario": mat["prezzo_unitario"],
        "subtotale": subtotale,
    }


def crea_voce_manodopera(descrizione: str, ore: float, tariffa: float) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "descrizione": descrizione,
        "ore": ore,
        "tariffa_oraria": tariffa,
        "subtotale": round(ore * tariffa, 2),
    }


def totali(voci_mat: list[dict], voci_man: list[dict], sconto_pct: float = 0.0, aliquota: float = 22.0) -> dict:
    lordo = round(
        sum(v["subtotale"] for v in voci_mat) + sum(m["subtotale"] for m in voci_man), 2
    )
    imponibile = round(lordo * (1 - sconto_pct / 100), 2)
    iva = round(imponibile * aliquota / 100, 2)
    return {
        "sconto_percentuale": sconto_pct,
        "aliquota_iva": aliquota,
        "totale_imponibile": imponibile,
        "totale_iva": iva,
        "totale_preventivo": round(imponibile + iva, 2),
    }


def crea_preventivo(numero: str, *, cliente: dict, titolo: str, giorni: int, stato: str,
                    voci_mat: list[dict], voci_man: list[dict], sconto: float = 0.0,
                    note: str = "Pagamento a saldo entro 30 giorni dalla data di emissione.") -> dict:
    doc = {
        "id": str(uuid.uuid4()),
        "numero": numero,
        "data_emissione": giorni_fa(giorni),
        "validita_giorni": 30,
        "cliente_nome": cliente["nome"],
        "cliente_telefono": cliente.get("telefono", ""),
        "cliente_email": cliente.get("email", ""),
        "cliente_indirizzo": cliente.get("indirizzo", ""),
        "cliente_piva": cliente.get("piva", ""),
        "titolo_intervento": titolo,
        "voci_materiali": voci_mat,
        "voci_manodopera": voci_man,
        "stato": stato,
        "note_condizioni": note,
        "lavoro_id": "",
        "created_at": utc_now() - timedelta(days=giorni),
    }
    doc.update(totali(voci_mat, voci_man, sconto))
    return doc


LAVORI = [
    {"titolo": "Rifacimento impianto elettrico appartamento", "cliente_nome": "Marco Bianchi", "cliente_telefono": "333 1234567", "cliente_indirizzo": "Via Roma 12, Verona", "descrizione": "Impianto completo: quadro nuovo, 12 punti presa, 8 punti luce, canaline incasso.", "stato": "in_corso", "data_inizio": giorni_fa(12), "data_fine_prevista": giorni_fa(-10), "prezzo_pattuito": 4200.0, "ore_manodopera": 18, "note": "Cliente presente il martedì e giovedì pomeriggio."},
    {"titolo": "Installazione wallbox ricarica auto elettrica", "cliente_nome": "Laura Ferri", "cliente_telefono": "335 9876543", "cliente_indirizzo": "Via Verdi 8, Verona", "descrizione": "Wallbox 7,4 kW in garage, linea dedicata da quadro al piano interrato.", "stato": "da_iniziare", "data_inizio": giorni_fa(-5), "data_fine_prevista": giorni_fa(-4), "prezzo_pattuito": 850.0, "ore_manodopera": 0, "note": ""},
    {"titolo": "Sostituzione quadro salvavita con magnetotermici", "cliente_nome": "Giorgio Conti", "cliente_telefono": "340 5551234", "cliente_indirizzo": "Via Mazzini 44, Verona", "descrizione": "Remozione vecchio quadro, installazione 12 magnetotermici + 2 differenziali, etichettatura.", "stato": "completato", "data_inizio": giorni_fa(30), "data_fine_prevista": giorni_fa(20), "prezzo_pattuito": 1200.0, "ore_manodopera": 9, "note": "Consegna dichiarazione di conformità fatta."},
    {"titolo": "Nuovo impianto luci giardino privato", "cliente_nome": "Anna Riva", "cliente_telefono": "331 7778899", "cliente_indirizzo": "Via dei Fiori 3, Verona", "descrizione": "8 faretti led a pavimento, linea interrata, comando da centralina.", "stato": "da_iniziare", "data_inizio": giorni_fa(-15), "data_fine_prevista": giorni_fa(-12), "prezzo_pattuito": 2300.0, "ore_manodopera": 0, "note": "Verificare posa cavi con giardinaggio."},
    {"titolo": "Riparazione corto circuito ufficio", "cliente_nome": "Studio Dentistico Sorriso", "cliente_telefono": "345 2200110", "cliente_indirizzo": "Via Dante 19, Verona", "descrizione": "Intervento urgente: ricerca guasto, sostituzione linea prese sala operatoria.", "stato": "completato", "data_inizio": giorni_fa(8), "data_fine_prevista": giorni_fa(8), "prezzo_pattuito": 350.0, "ore_manodopera": 4, "note": ""},
    {"titolo": "Aggiornamento impianto bagno ristrutturato", "cliente_nome": "Paolo Neri", "cliente_telefono": "348 2223344", "cliente_indirizzo": "Via Toscanini 7, Verona", "descrizione": "Nuove prese con differenziale dedicato, punto luce specchio, ventola.", "stato": "in_corso", "data_inizio": giorni_fa(4), "data_fine_prevista": giorni_fa(-3), "prezzo_pattuito": 900.0, "ore_manodopera": 6, "note": ""},
]

ORE_SEED = {
    "Rifacimento impianto elettrico appartamento": [
        {"data": giorni_fa(10), "ore": 6, "tariffa_oraria": 35.0, "descrizione": "Demolizione e posa canaline"},
        {"data": giorni_fa(7), "ore": 8, "tariffa_oraria": 35.0, "descrizione": "Cablaggio quadro e prese"},
        {"data": giorni_fa(2), "ore": 4, "tariffa_oraria": 35.0, "descrizione": "Verifiche e collaudo"},
    ],
    "Aggiornamento impianto bagno ristrutturato": [
        {"data": giorni_fa(3), "ore": 5, "tariffa_oraria": 35.0, "descrizione": "Posa scatole e tubazioni"},
        {"data": giorni_fa(1), "ore": 3, "tariffa_oraria": 35.0, "descrizione": "Montaggio punti luce"},
    ],
}

CLIENTI = {
    "marco": {"nome": "Marco Bianchi", "telefono": "333 1234567", "email": "marco.bianchi@email.it", "indirizzo": "Via Roma 12, Verona", "piva": ""},
    "laura": {"nome": "Laura Ferri", "telefono": "335 9876543", "email": "laura.ferri@email.it", "indirizzo": "Via Verdi 8, Verona", "piva": ""},
    "anna": {"nome": "Anna Riva", "telefono": "331 7778899", "email": "anna.riva@email.it", "indirizzo": "Via dei Fiori 3, Verona", "piva": ""},
    "paolo": {"nome": "Paolo Neri", "telefono": "348 2223344", "email": "", "indirizzo": "Via Toscanini 7, Verona", "piva": ""},
    "giorgio": {"nome": "Giorgio Conti", "telefono": "340 5551234", "email": "", "indirizzo": "Via Mazzini 44, Verona", "piva": ""},
}


async def main() -> None:
    if await db.materiali.count_documents({}) > 0:
        print("Seed già eseguito: collezioni non vuote.")
        return

    anno = today_iso()[:4]
    mat_docs: list[dict] = []
    for m in MATERIALI:
        doc = {"id": str(uuid.uuid4()), **m, "created_at": utc_now() - timedelta(days=45)}
        mat_docs.append(doc)
    await db.materiali.insert_many(mat_docs)
    per_nome = {m["nome"]: m for m in mat_docs}

    lavori_docs: list[dict] = []
    for i, l in enumerate(LAVORI):
        doc = {
            "id": str(uuid.uuid4()),
            **l,
            "materiali_usati": [],
            "ore_lavorate": [
                {"id": str(uuid.uuid4()), **o, "preventivo_id": ""}
                for o in ORE_SEED.get(l["titolo"], [])
            ],
            "created_at": utc_now() - timedelta(days=40 - i * 5),
        }
        lavori_docs.append(doc)
    await db.lavori.insert_many(lavori_docs)

    voci_wallbox_mat = [
        crea_voce_materiale(per_nome["Cavo FG16OR 3G1,5"], 20),
        crea_voce_materiale(per_nome["Pressacavo Ø20"], 4),
        crea_voce_materiale(per_nome["Magnetotermico bipolare 16A curva C"], 1),
    ]
    voci_wallbox_man = [
        crea_voce_manodopera("Posa linea dedicata e wallbox", 6, 40.0),
    ]

    voci_giardino_mat = [
        crea_voce_materiale(per_nome["Faretto LED 7W orientabile"], 8),
        crea_voce_materiale(per_nome["Cavo FS18 3G2,5"], 60),
        crea_voce_materiale(per_nome["Tubo corrugato Ø20"], 40),
    ]
    voci_giardino_man = [
        crea_voce_manodopera("Scavo, posa cavi e montaggio faretti", 10, 35.0),
    ]

    voci_bagno_mat = [
        crea_voce_materiale(per_nome["Presa bipasso BTicino Living Now"], 4),
        crea_voce_materiale(per_nome["Interruttore unipolare BTicino Living Now"], 3),
        crea_voce_materiale(per_nome["Presa USB A+C BTicino Living Now"], 1),
        crea_voce_materiale(per_nome["Cavo FS18 3G2,5"], 40),
    ]
    voci_bagno_man = [
        crea_voce_manodopera("Aggiornamento impianto bagno", 8, 35.0),
    ]

    voci_rifacimento_mat = [
        crea_voce_materiale(per_nome["Quadro elettrico 24 moduli"], 1),
        crea_voce_materiale(per_nome["Differenziale bipolare 25A 30mA"], 2),
        crea_voce_materiale(per_nome["Cavo FS18 3G2,5"], 120),
        crea_voce_materiale(per_nome["Tubo corrugato Ø20"], 50),
        crea_voce_materiale(per_nome["Presa bipasso BTicino Living Now"], 12),
        crea_voce_materiale(per_nome["Interruttore unipolare BTicino Living Now"], 8),
    ]
    voci_rifacimento_man = [
        crea_voce_manodopera("Demolizione e posa canaline incasso", 12, 35.0),
        crea_voce_manodopera("Cablaggio impianto e collaudo", 16, 35.0),
    ]

    voci_domotica_mat = [
        crea_voce_materiale(per_nome["Pannello LED 60x60 40W"], 4),
        crea_voce_materiale(per_nome["Morsetti rapidi 2 poli"], 2),
    ]
    voci_domotica_man = [crea_voce_manodopera("Installazione plafoniere dimmerizzate", 6, 40.0)]

    preventivi = [
        crea_preventivo(
            f"P-{anno}-0001", cliente=CLIENTI["marco"], titolo="Rifacimento impianto elettrico appartamento",
            giorni=10, stato="inviato", voci_mat=voci_rifacimento_mat, voci_man=voci_rifacimento_man,
        ),
        crea_preventivo(
            f"P-{anno}-0002", cliente=CLIENTI["laura"], titolo="Installazione wallbox ricarica auto elettrica",
            giorni=7, stato="inviato", voci_mat=voci_wallbox_mat, voci_man=voci_wallbox_man,
        ),
        crea_preventivo(
            f"P-{anno}-0003", cliente=CLIENTI["anna"], titolo="Nuovo impianto luci giardino privato",
            giorni=5, stato="bozza", voci_mat=voci_giardino_mat, voci_man=voci_giardino_man,
        ),
        crea_preventivo(
            f"P-{anno}-0004", cliente=CLIENTI["paolo"], titolo="Aggiornamento impianto bagno ristrutturato",
            giorni=15, stato="accettato", voci_mat=voci_bagno_mat, voci_man=voci_bagno_man,
        ),
        crea_preventivo(
            f"P-{anno}-0005", cliente=CLIENTI["giorgio"], titolo="Sistema di illuminazione dimmerizzabile salotto",
            giorni=25, stato="rifiutato", voci_mat=voci_domotica_mat, voci_man=voci_domotica_man,
            note="Cliente ha preferito altro fornitore.",
        ),
        # Inviato 45 giorni fa con validità 30: scaduto, richiede follow-up.
        crea_preventivo(
            f"P-{anno}-0006", cliente=CLIENTI["giorgio"], titolo="Quadro elettrico garage e linea dedicata",
            giorni=45, stato="inviato", voci_mat=voci_wallbox_mat, voci_man=voci_wallbox_man,
        ),
    ]
    await db.preventivi.insert_many(preventivi)

    clienti_docs = [
        {
            "id": str(uuid.uuid4()),
            "nome": c["nome"],
            "telefono": c.get("telefono", ""),
            "email": c.get("email", ""),
            "indirizzo": c.get("indirizzo", ""),
            "piva": c.get("piva", ""),
            "note": "",
            "created_at": utc_now() - timedelta(days=40),
        }
        for c in CLIENTI.values()
    ]
    clienti_docs.append(
        {
            "id": str(uuid.uuid4()),
            "nome": "Studio Dentistico Sorriso",
            "telefono": "345 2200110",
            "email": "info@studiosorriso.it",
            "indirizzo": "Via Dante 19, Verona",
            "piva": "02345678901",
            "note": "Interventi solo fuori orario di apertura.",
            "created_at": utc_now() - timedelta(days=20),
        }
    )
    await db.clienti.insert_many(clienti_docs)

    await ensure_indexes()
    print(
        f"Seed completato: {len(mat_docs)} materiali, {len(lavori_docs)} lavori, "
        f"{len(preventivi)} preventivi, {len(clienti_docs)} clienti."
    )


if __name__ == "__main__":
    asyncio.run(main())
