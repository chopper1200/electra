# PRD — VoltCraft Elettrica

**Problema**: gestire il lavoro quotidiano di un elettricista (cantieri, materiali in magazzino, preventivi ai clienti) con uno strumento semplice, mobile-first, in italiano.

**Ambito MVP (richiesto dall'utente: "Gestione lavori materiali e preventivi")**:
1. **Lavori** — anagrafica interventi per cliente con stato (da iniziare / in corso / completato), date, prezzo pattuito, contatti con chiamata/WhatsApp rapida.
2. **Materiali** — catalogo per categorie con prezzi (costo/vendita), unità di misura e giacenze; movimenti di carico/scarico; avvisi sotto scorta; scarico automatico del materiale usato in cantiere sui lavori.
3. **Preventivi** — builder con voci materiale (dal catalogo) e manodopera (ore × tariffa), sconto e IVA (22% / 10% agevolata), totali calcolati server-side, workflow di stato (bozza → inviato → accettato/rifiutato), duplicazione, foglio stampabile/PDF e conversione in lavoro quando accettato.
4. **Dashboard** — KPI e riepiloghi (lavori attivi, preventivi in attesa, scorte da riordinare, valore da incassare).

**Non incluso (fasi future)**: autenticazione multi-utente, fatturazione vera e propria, foto cantieri, agenda/schedulazione.
