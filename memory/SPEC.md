# SPEC — VoltCraft Elettrica

App in italiano per la gestione del lavoro di un elettricista: **Lavori, Materiali (magazzino), Preventivi**. Single-user, **nessuna autenticazione**. Backend FastAPI + MongoDB (motor), frontend Vite + React 19 + TS strict + Tailwind v4 dark/ambra.

## Routing frontend
- `/` Dashboard (KPI: lavori in corso, preventivi in attesa, **scaduti da ricontattare**, sotto scorta; **riepilogo ore del mese** con valore € e ripartizione per cantiere; **pannello preventivi scaduti** con chiamata/WhatsApp e «Rinnova 30 gg»; pannelli lavori attivi, preventivi recenti, sotto scorta)
- `/clienti` Anagrafica clienti: card con contatti, P.IVA, storico (n. lavori/preventivi e valore), ricerca, CRUD
- `/lavori` elenco lavori con filtri per stato, cambio stato inline, chiamata/WhatsApp, registrazione materiali usati, **registro ore** (ore lavorate con tariffa, importabili nei preventivi)
- `/materiali` catalogo + magazzino: ricerca, filtro categoria, movimenti carico/scarico, badge "sotto scorta", **importazione listino fornitore da Excel/CSV** (modale con drag&drop, mapping colonne mostrato, modello scaricabile)
- `/preventivi` card preventivi con stati, **badge «Scaduto» e countdown validità**, azioni (modifica, duplica, crea lavoro, elimina)
- `/preventivi/nuovo` e `/preventivi/:id/modifica` builder preventivo (voci materiale da catalogo + manodopera, sconto %, IVA 22/10, totali live)
- `/preventivi/:id` foglio preventivo stampabile (bottone "Stampa / PDF" → window.print(), CSS @media print)

## API (tutte su api_router, prefisso /api)
- `GET/POST /api/lavori`, `GET/PUT/DELETE /api/lavori/{id}`, `PATCH /api/lavori/{id}/stato`
- `POST /api/lavori/{id}/materiali` {materiale_id, quantita} — aggiunge voce + **decrementa la giacenza**
- `DELETE /api/lavori/{id}/materiali/{usage_id}` — rimuove voce e **ripristina la giacenza**
- `POST /api/lavori/{id}/ore` {data, ore, tariffa_oraria, descrizione} — registra ore lavorate
- `DELETE /api/lavori/{id}/ore/{entry_id}` — rimuove la voce ore (bloccata con 400 se già inclusa in un preventivo)
- `GET/POST /api/materiali`, `PUT/DELETE /api/materiali/{id}`, `PATCH /api/materiali/{id}/stock` {delta: ±}
- `POST /api/materiali/import` (multipart, campo `file`) — importa un listino fornitore .xlsx/.csv (max 5 MB). Query: `aggiorna_esistenti` (default true), `azzera_giacenze` (default false). Risponde con `{creati, aggiornati, ignorati, totale_righe, colonne_riconosciute, avvisi, anteprima}`. 400 formato/dimensione non validi, 422 se non trova la colonna descrizione.
- `GET /api/materiali/import/modello` — scarica il modello Excel con le intestazioni attese.
- `GET/POST /api/preventivi`, `GET/PUT/DELETE /api/preventivi/{id}`, `PATCH /api/preventivi/{id}/stato`
- `PATCH /api/preventivi/{id}/rinnova` {validita_giorni} — follow-up: ri-emette da oggi con nuova validità e stato `inviato`
- `POST /api/preventivi/{id}/invia` — invia il preventivo per email al cliente e segna lo stato `inviato`, salvando `email_inviata_a` e `data_invio_email`. Il destinatario è letto dal documento salvato (`cliente_email`) e il corpo HTML deriva da un template server-side in `routers/preventivi.py` (`_corpo_email`): il client passa solo l'id, mai indirizzi o markup. 400 se il cliente non ha email.
- `GET/POST /api/clienti`, `PUT/DELETE /api/clienti/{id}` — anagrafica (409 se il nome esiste già)
- `POST /api/preventivi/{id}/duplica` (nuova bozza con nuovo numero), `POST /api/preventivi/{id}/converti` (solo stato=accettato, una volta sola: crea Lavoro con cliente/materiali/totale)
- Importazione ore: nel builder preventivo si sceglie il lavoro e si importano le sue ore non ancora preventivate (ore con `preventivo_id` vuoto o pari al preventivo corrente); al salvataggio il server marca le ore (`_sync_ore_lavorate`, richiamata anche su modifica/eliminazione del preventivo per riallineare i contrassegni). Un'ora marcata non si può cancellare dal registro.
- `GET /api/dashboard` — statistiche aggregate

- **Cliente**: nome (univoco, match case-insensitive), telefono, email, indirizzo, piva, note. `upsert_cliente()` in routers/clienti.py viene richiamato alla creazione/modifica di lavori e preventivi: salva il cliente la prima volta e completa solo i campi ancora vuoti, senza sovrascrivere quelli inseriti a mano.
- Scadenze: `con_scadenza()` in routers/preventivi.py arricchisce ogni preventivo con `data_scadenza` (= emissione + validita_giorni), `giorni_alla_scadenza` e `scaduto` (vero solo se stato=`inviato` e i giorni sono negativi) — calcolati sulla data del server, non nel browser.
- Riepilogo ore: la dashboard somma le `ore_lavorate` con `data` nel mese corrente (`current_month_iso()`), esponendo `ore_mese`, `valore_ore_mese`, `tariffa_media_mese` e `ore_mese_per_lavoro`.

## Modelli (Pydantic ↔ TS mirror manuale in frontend/src/lib/types.ts)
- **Lavoro**: titolo, cliente_nome, cliente_telefono, cliente_indirizzo, descrizione, stato(da_iniziare|in_corso|completato), data_inizio, data_fine_prevista, prezzo_pattuito, ore_manodopera, note, materiali_usati[{materiale_id, nome, quantita, unita, prezzo_unitario}], ore_lavorate[{data, ore, tariffa_oraria, descrizione, preventivo_id}]
- **Materiale**: codice_art, nome, categoria(6 categorie italiane), unita_misura(pz|m|conf|rotolo), prezzo_unitario, prezzo_costo, quantita_disponibile, scorta_minima, fornitore
- **Preventivo**: numero progressivo server-side "P-<anno>-NNNN", data_emissione, validita_giorni, dati cliente, titolo_intervento, voci_materiali, voci_manodopera{descrizione,ore,tariffa_oraria,lavoro_id?,ore_entry_id? — righe importabili dal registro ore di un cantiere}, sconto_percentuale, aliquota_iva(22|10), totale_imponibile/totale_iva/totale_preventivo **calcolati server-side**, stato(bozza|inviato|accettato|rifiutato), note_condizioni, lavoro_id

## Icona e branding
Icona generata (fulmine ambra su obsidian) in `frontend/public/`: `favicon.ico` (multi-size), `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` (180, angoli arrotondati), `icon-192.png`, `icon-512.png` (quadrata piena per maskable Android) più `manifest.webmanifest` (nome "VoltCraft Elettrica", short_name "VoltCraft", theme/background `#0B0F17`, display standalone) — l'app si può installare sul telefono dalla home.

## Dati
L'app parte **vuota**: nessun dato di esempio, nessuno script di seed (rimosso su richiesta dell'utente, che inserisce i propri dati reali). Le collezioni Mongo (`lavori`, `materiali`, `preventivi`, `clienti`) vengono create al primo inserimento; gli indici sono garantiti da `ensure_indexes()` allo startup di server.py. Ogni pagina ha il proprio empty state in italiano che spiega come iniziare.

## Tema (design_guidelines.json, archetipo «The Performance Pro»)
Dark obsidian/navy: pagina `#0B0F17`, pannelli `#111827`, superfici elevate `#162032`, bordi `#1E293B`/`#27364F`, accento ambra `#F59E0B`, info `#38BDF8`, urgenza `#2A1418`/`#F87171`. Font: Outfit (heading), Plus Jakarta Sans (body), JetBrains Mono (numeri/importi) — tutti via `@fontsource-variable` in index.css. Micro-interazioni: hover con lift `-translate-y-0.5` sulle card, transizioni mirate 150-200ms, keyframes `fade-in-up` e `pulse-attention`.

## Integrazioni
**Importazione listino** — `backend/lib/listino.py`: parser tollerante per i listini dei fornitori. Mappa le intestazioni italiane più comuni sui campi del catalogo (sinonimi in `COLONNE`, match esatto poi parziale, accenti/punteggiatura ignorati), salta le righe di titolo/logo cercando la vera intestazione nelle prime 8 righe, normalizza le unità (`MT`→m, `cad`/`pezzi`→pz, `CF`→conf, `bobina`→rotolo) e i numeri in formato italiano (`1.234,56`, `12,50 €`). Se la categoria manca o non è riconosciuta la deduce dal nome articolo con le parole chiave in `INDIZI_CATEGORIA`. Gli articoli sono riconosciuti dal codice articolo, o dal nome se il codice manca: ricaricare un listino aggiornato aggiorna i prezzi senza creare duplicati. Dipendenze già nel venv: pandas, openpyxl, python-multipart. Nota: i vecchi `.xls` non sono supportati (serve `xlrd`), l'utente carica `.xlsx` o `.csv`.

**Email (Resend gestito da Emergent)** — `backend/lib/email.py`: `send_email()` POSTa su `https://integrations.emergentagent.com/api/v1/email/send` con header `X-Email-Key`. Env in backend/.env: `EMERGENT_EMAIL_KEY` e `EMAIL_FROM_NAME=VoltCraft Elettrica` (nome mittente visibile; l'indirizzo From è gestito dalla piattaforma). `_assert_safe_email()` è un gate obbligatorio chiamato su ogni invio (blocca form/input, link non-https, richieste di credenziali) — non va indebolito né avvolto in try/except. Nessuna chiave dell'utente richiesta. Opzionale: `EMAIL_REPLY_TO` per far arrivare le risposte a una casella dell'elettricista (non ancora impostata).

## Note
- Credenziali: nessuna — l'app è senza login (vedi memory/test_credentials.md).
- Date formattate it-IT (DD/MM/YYYY), EUR it-IT; "oggi" ancorato lato server con `lib/dates.today_iso()`.
- Le date input dell'editor usano default client-side solo come display; il server ri-ancora se vuote.
- Print: `@media print` in index.css nasconde `.no-print` (nav, toolbar) e resetta lo sfondo.
