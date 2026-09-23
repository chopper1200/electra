# SPEC — VoltCraft Elettrica

App in italiano per la gestione del lavoro di un elettricista: **Lavori, Materiali (magazzino), Preventivi**. Single-user, **nessuna autenticazione**. Backend FastAPI + MongoDB (motor), frontend Vite + React 19 + TS strict + Tailwind v4 dark/ambra.

## Routing frontend
- `/` Dashboard (KPI: lavori in corso, preventivi in attesa, sotto scorta, da incassare; pannelli lavori attivi, preventivi recenti, sotto scorta)
- `/lavori` elenco lavori con filtri per stato, cambio stato inline, chiamata/WhatsApp, registrazione materiali usati, **registro ore** (ore lavorate con tariffa, importabili nei preventivi)
- `/materiali` catalogo + magazzino: ricerca, filtro categoria, movimenti carico/scarico, badge "sotto scorta"
- `/preventivi` card preventivi con stati e azioni (modifica, duplica, crea lavoro, elimina)
- `/preventivi/nuovo` e `/preventivi/:id/modifica` builder preventivo (voci materiale da catalogo + manodopera, sconto %, IVA 22/10, totali live)
- `/preventivi/:id` foglio preventivo stampabile (bottone "Stampa / PDF" → window.print(), CSS @media print)

## API (tutte su api_router, prefisso /api)
- `GET/POST /api/lavori`, `GET/PUT/DELETE /api/lavori/{id}`, `PATCH /api/lavori/{id}/stato`
- `POST /api/lavori/{id}/materiali` {materiale_id, quantita} — aggiunge voce + **decrementa la giacenza**
- `DELETE /api/lavori/{id}/materiali/{usage_id}` — rimuove voce e **ripristina la giacenza**
- `POST /api/lavori/{id}/ore` {data, ore, tariffa_oraria, descrizione} — registra ore lavorate
- `DELETE /api/lavori/{id}/ore/{entry_id}` — rimuove la voce ore (bloccata con 400 se già inclusa in un preventivo)
- `GET/POST /api/materiali`, `PUT/DELETE /api/materiali/{id}`, `PATCH /api/materiali/{id}/stock` {delta: ±}
- `GET/POST /api/preventivi`, `GET/PUT/DELETE /api/preventivi/{id}`, `PATCH /api/preventivi/{id}/stato`
- `POST /api/preventivi/{id}/duplica` (nuova bozza con nuovo numero), `POST /api/preventivi/{id}/converti` (solo stato=accettato, una volta sola: crea Lavoro con cliente/materiali/totale)
- Importazione ore: nel builder preventivo si sceglie il lavoro e si importano le sue ore non ancora preventivate (ore con `preventivo_id` vuoto o pari al preventivo corrente); al salvataggio il server marca le ore (`_sync_ore_lavorate`, richiamata anche su modifica/eliminazione del preventivo per riallineare i contrassegni). Un'ora marcata non si può cancellare dal registro.
- `GET /api/dashboard` — statistiche aggregate

## Modelli (Pydantic ↔ TS mirror manuale in frontend/src/lib/types.ts)
- **Lavoro**: titolo, cliente_nome, cliente_telefono, cliente_indirizzo, descrizione, stato(da_iniziare|in_corso|completato), data_inizio, data_fine_prevista, prezzo_pattuito, ore_manodopera, note, materiali_usati[{materiale_id, nome, quantita, unita, prezzo_unitario}], ore_lavorate[{data, ore, tariffa_oraria, descrizione, preventivo_id}]
- **Materiale**: codice_art, nome, categoria(6 categorie italiane), unita_misura(pz|m|conf|rotolo), prezzo_unitario, prezzo_costo, quantita_disponibile, scorta_minima, fornitore
- **Preventivo**: numero progressivo server-side "P-<anno>-NNNN", data_emissione, validita_giorni, dati cliente, titolo_intervento, voci_materiali, voci_manodopera{descrizione,ore,tariffa_oraria,lavoro_id?,ore_entry_id? — righe importabili dal registro ore di un cantiere}, sconto_percentuale, aliquota_iva(22|10), totale_imponibile/totale_iva/totale_preventivo **calcolati server-side**, stato(bozza|inviato|accettato|rifiutato), note_condizioni, lavoro_id

## Seed
`cd /app/backend && python seed.py` — idempotente (salta se `materiali` non è vuota). Crea 18 materiali reali (BTicino Living Now, FS18, differenziale Gewiss…), 6 lavori, 5 preventivi P-<anno>-0001…0005 in stati diversi (2 inviati, 1 bozza, 1 accettato, 1 rifiutato), 4 materiali sotto scorta, ore lavorate di esempio su 2 cantieri (registro ore, importabili nei preventivi).

## Note
- Credenziali: nessuna — l'app è senza login (vedi memory/test_credentials.md).
- Date formattate it-IT (DD/MM/YYYY), EUR it-IT; "oggi" ancorato lato server con `lib/dates.today_iso()`.
- Le date input dell'editor usano default client-side solo come display; il server ri-ancora se vuote.
- Print: `@media print` in index.css nasconde `.no-print` (nav, toolbar) e resetta lo sfondo.
