# VoltCraft Elettrica — versione statica su GitHub Pages

Questa guida spiega come pubblicare l'app come **sito statico** su un repository GitHub
**pubblico**, protetta da un **PIN di accesso**.

## Cosa cambia nella versione statica

| Funzione | Versione completa (qui su Emergent) | Versione statica (GitHub Pages) |
| --- | --- | --- |
| Lavori, materiali, preventivi, clienti, ore | ✅ | ✅ |
| Lista materiali da comprare + lista spesa unica | ✅ | ✅ |
| Carico automatico giacenza | ✅ | ✅ |
| Dashboard, ricarico prezzi, carico rapido | ✅ | ✅ |
| Dove stanno i dati | database sul server | **solo nel browser del dispositivo** (localStorage) |
| Invio preventivo per email | ✅ | ❌ (serve un server) |
| PDF preventivo generato dal server | ✅ | ❌ — resta «Stampa» del browser (Stampa → Salva come PDF) |
| Importazione listino Excel | ✅ | ❌ (serve un server) |

> I dati **non finiscono su GitHub**: nel repository c'è solo il codice. Ogni dispositivo
> ha la sua copia dei dati e non si sincronizzano tra loro. Fai una copia dei dati
> importanti (es. stampa i preventivi in PDF) prima di cancellare i dati del browser.

## PIN di accesso

- PIN attuale: **1987**
- Nel codice non c'è il PIN in chiaro, ma solo il suo hash SHA-256
  (`frontend/src/components/PinLock.tsx`).
- Lo sbloccò vale fino alla chiusura del browser (sessionStorage).
- ⚠️ Onestà tecnica: in un sito statico la verifica avviene nel browser, quindi il PIN
  **blocca l'accesso casuale** ma non è una protezione crittografica: chi legge il codice
  pubblico può aggirarlo. Non è un problema di privacy perché sul sito **non ci sono dati**:
  i tuoi dati restano nel tuo dispositivo.

### Cambiare il PIN

```bash
# calcola l'hash del nuovo PIN
python3 -c "import hashlib;print(hashlib.sha256('NUOVOPIN'.encode()).hexdigest())"
```

Poi, dalla cartella `frontend/`:

```bash
VITE_PIN_HASH=<hash_appena_calcolato> yarn build:static
```

oppure sostituisci il valore di default in `src/components/PinLock.tsx`.

## Generare il sito statico

```bash
cd frontend
yarn install
yarn build:static      # scrive in ../docs (con .nojekyll e 404.html)
```

Il comando produce la cartella `docs/` alla radice del progetto: è quella che GitHub Pages
pubblica.

## Pubblicare su GitHub

```bash
git add -A
git commit -m "App elettricista: versione statica con PIN"
git push origin main
```

Poi su GitHub:

1. apri il repository → **Settings** → **Pages**
2. *Source*: **Deploy from a branch**
3. *Branch*: `main`, cartella **/docs** → **Save**
4. dopo un minuto il sito è online su `https://<tuo-utente>.github.io/<nome-repo>/`

Ogni volta che modifichi l'app: ripeti `yarn build:static`, poi commit e push.

## Installarla sul telefono

Apri il link `github.io` con Chrome/Safari → menu → **Aggiungi alla schermata Home**:
si apre a tutto schermo come un'app (manifest e icone sono già inclusi).

## Cosa NON mettere nel repository pubblico

- `backend/.env` (chiavi email, MONGO_URL) — è già escluso dal push della piattaforma:
  non aggiungerlo mai a mano
- dump del database o esportazioni con dati dei clienti
