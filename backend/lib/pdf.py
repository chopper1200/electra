"""Generazione del PDF del preventivo (reportlab platypus).

Il layout ricalca il foglio stampabile dell'app: intestazione VoltCraft,
dati cliente, tabelle materiali/manodopera, totali e condizioni.
"""

import io

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

AMBRA = colors.HexColor("#B45309")
INCHIOSTRO = colors.HexColor("#0F172A")
GRIGIO = colors.HexColor("#64748B")
BORDO = colors.HexColor("#CBD5E1")
FONDO_TESTA = colors.HexColor("#F1F5F9")


def _euro(valore: float) -> str:
    intero, _, dec = f"{float(valore or 0):,.2f}".partition(".")
    return f"{intero.replace(',', '.')},{dec} €"


def _numero(valore: float) -> str:
    testo = f"{float(valore or 0):g}"
    return testo.replace(".", ",")


def _data_it(iso: str) -> str:
    parti = str(iso or "")[:10].split("-")
    return f"{parti[2]}/{parti[1]}/{parti[0]}" if len(parti) == 3 else "—"


def _stili() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "brand": ParagraphStyle(
            "brand", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=16, textColor=AMBRA, leading=19,
        ),
        "brand_sub": ParagraphStyle(
            "brand_sub", parent=base["Normal"], fontSize=7.5, textColor=GRIGIO, leading=10,
        ),
        "meta": ParagraphStyle(
            "meta", parent=base["Normal"], fontSize=8, textColor=GRIGIO,
            leading=11, alignment=TA_RIGHT,
        ),
        "meta_num": ParagraphStyle(
            "meta_num", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=12, textColor=INCHIOSTRO, leading=15, alignment=TA_RIGHT,
        ),
        "etichetta": ParagraphStyle(
            "etichetta", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=7, textColor=GRIGIO, leading=10,
        ),
        "corpo": ParagraphStyle("corpo", parent=base["Normal"], fontSize=9, leading=12.5),
        "corpo_bold": ParagraphStyle(
            "corpo_bold", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=10, leading=13,
        ),
        "titolo": ParagraphStyle(
            "titolo", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=14, textColor=INCHIOSTRO, leading=17,
        ),
        "sezione": ParagraphStyle(
            "sezione", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=8, textColor=GRIGIO, leading=11,
        ),
        "cella": ParagraphStyle("cella", parent=base["Normal"], fontSize=8.5, leading=11),
        "note": ParagraphStyle("note", parent=base["Normal"], fontSize=8, textColor=GRIGIO, leading=11),
    }


def _tabella_voci(intestazioni: list[str], righe: list[list], larghezze: list[float]) -> Table:
    tabella = Table([intestazioni] + righe, colWidths=larghezze, repeatRows=1, hAlign="LEFT")
    tabella.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), FONDO_TESTA),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("TEXTCOLOR", (0, 0), (-1, 0), INCHIOSTRO),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.4, BORDO),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return tabella


def preventivo_pdf(doc: dict, *, azienda: str) -> bytes:
    """Costruisce il PDF del preventivo e lo restituisce come bytes."""
    s = _stili()
    buffer = io.BytesIO()
    pdf = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Preventivo {doc.get('numero', '')}",
        author=azienda,
        subject=doc.get("titolo_intervento", ""),
    )
    larghezza = pdf.width
    flow: list = []

    # Intestazione: brand a sinistra, riferimenti del preventivo a destra
    testa = Table(
        [
            [
                [
                    Paragraph(azienda, s["brand"]),
                    Paragraph(
                        "Impianti elettrici · Manutenzione · Certificazioni", s["brand_sub"]
                    ),
                ],
                [
                    Paragraph("PREVENTIVO", s["meta"]),
                    Paragraph(str(doc.get("numero", "")), s["meta_num"]),
                    Paragraph(
                        f"Emissione {_data_it(doc.get('data_emissione', ''))}<br/>"
                        f"Validità {doc.get('validita_giorni', 30)} giorni",
                        s["meta"],
                    ),
                ],
            ]
        ],
        colWidths=[larghezza * 0.58, larghezza * 0.42],
    )
    testa.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    flow += [testa, Spacer(1, 6), HRFlowable(width="100%", thickness=1.5, color=AMBRA), Spacer(1, 10)]

    # Dati cliente
    contatti = [
        doc.get("cliente_indirizzo", ""),
        doc.get("cliente_telefono", ""),
        doc.get("cliente_email", ""),
        f"P.IVA {doc['cliente_piva']}" if doc.get("cliente_piva") else "",
    ]
    flow += [
        Paragraph("CLIENTE", s["etichetta"]),
        Spacer(1, 2),
        Paragraph(str(doc.get("cliente_nome", "")), s["corpo_bold"]),
    ]
    for riga in [c for c in contatti if c]:
        flow.append(Paragraph(str(riga), s["corpo"]))
    flow += [
        Spacer(1, 12),
        Paragraph(str(doc.get("titolo_intervento", "")), s["titolo"]),
        Spacer(1, 12),
    ]

    voci_mat = doc.get("voci_materiali", []) or []
    if voci_mat:
        righe = [
            [
                Paragraph(str(v.get("nome", "")), s["cella"]),
                f"{_numero(v.get('quantita', 0))} {v.get('unita', 'pz')}",
                _euro(v.get("prezzo_unitario", 0)),
                _euro(v.get("subtotale", 0)),
            ]
            for v in voci_mat
        ]
        flow += [
            Paragraph("MATERIALI", s["sezione"]),
            Spacer(1, 4),
            _tabella_voci(
                ["Voce", "Q.tà", "Prezzo", "Subtotale"],
                righe,
                [larghezza * 0.46, larghezza * 0.16, larghezza * 0.18, larghezza * 0.20],
            ),
            Spacer(1, 12),
        ]

    voci_man = doc.get("voci_manodopera", []) or []
    if voci_man:
        righe = [
            [
                Paragraph(str(v.get("descrizione", "")), s["cella"]),
                f"{_numero(v.get('ore', 0))} h",
                _euro(v.get("tariffa_oraria", 0)),
                _euro(v.get("subtotale", 0)),
            ]
            for v in voci_man
        ]
        flow += [
            Paragraph("MANODOPERA", s["sezione"]),
            Spacer(1, 4),
            _tabella_voci(
                ["Descrizione", "Ore", "Tariffa", "Subtotale"],
                righe,
                [larghezza * 0.46, larghezza * 0.16, larghezza * 0.18, larghezza * 0.20],
            ),
            Spacer(1, 12),
        ]

    # Totali allineati a destra
    totali = Table(
        [
            ["Imponibile", _euro(doc.get("totale_imponibile", 0))],
            [f"IVA {_numero(doc.get('aliquota_iva', 22))}%", _euro(doc.get("totale_iva", 0))],
            ["Totale", _euro(doc.get("totale_preventivo", 0))],
        ],
        colWidths=[larghezza * 0.22, larghezza * 0.2],
        hAlign="RIGHT",
    )
    totali.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("TEXTCOLOR", (0, 0), (0, 1), GRIGIO),
                ("LINEABOVE", (0, 2), (-1, 2), 1.2, AMBRA),
                ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
                ("FONTSIZE", (0, 2), (-1, 2), 10.5),
                ("TEXTCOLOR", (1, 2), (1, 2), AMBRA),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    flow += [totali, Spacer(1, 14)]

    if doc.get("note_condizioni"):
        condizioni = Table(
            [[Paragraph(str(doc["note_condizioni"]), s["note"])]],
            colWidths=[larghezza],
        )
        condizioni.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), FONDO_TESTA),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        flow += [Paragraph("CONDIZIONI E NOTE", s["sezione"]), Spacer(1, 4), condizioni]

    def piede(canvas, _doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GRIGIO)
        canvas.drawString(
            18 * mm, 10 * mm, f"{azienda} — Preventivo {doc.get('numero', '')}"
        )
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Pagina {canvas.getPageNumber()}")
        canvas.restoreState()

    pdf.build(flow, onFirstPage=piede, onLaterPages=piede)
    return buffer.getvalue()
