// Backend locale per la BUILD STATICA (GitHub Pages): replica gli endpoint /api
// usando localStorage come database. Nessun dato lascia il dispositivo.
//
// Le funzioni che richiedono un server (invio email, PDF generato da reportlab,
// import listino Excel) rispondono 501 con un messaggio in italiano.
import type {
  Cliente,
  DashboardStats,
  Lavoro,
  ListaItem,
  ListaSpesaUnica,
  Materiale,
  OraLavorata,
  OrePerLavoro,
  Preventivo,
  RigaSpesa,
  VoceMateriale,
  VoceManodopera,
} from "@/lib/types";

const KEY = "voltcraft.db.v1";

interface DbShape {
  lavori: Lavoro[];
  materiali: Materiale[];
  preventivi: Preventivo[];
  clienti: Cliente[];
}

const EMPTY_DB: DbShape = { lavori: [], materiali: [], preventivi: [], clienti: [] };

export class StaticApiError extends Error {
  status: number;
  body: { detail: string };

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "StaticApiError";
    this.status = status;
    this.body = { detail };
  }
}

function load(): DbShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_DB };
    const parsed = JSON.parse(raw) as Partial<DbShape>;
    return {
      lavori: parsed.lavori ?? [],
      materiali: parsed.materiali ?? [],
      preventivi: parsed.preventivi ?? [],
      clienti: parsed.clienti ?? [],
    };
  } catch {
    return { ...EMPTY_DB };
  }
}

function save(db: DbShape): void {
  localStorage.setItem(KEY, JSON.stringify(db));
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const nowIso = () => new Date().toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);
const monthIso = () => new Date().toISOString().slice(0, 7);
const r2 = (n: number) => Math.round(n * 100) / 100;

function addDays(iso: string, giorni: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
}

function daysBetween(da: string, a: string): number {
  const ms = new Date(`${a}T00:00:00`).getTime() - new Date(`${da}T00:00:00`).getTime();
  return Math.round(ms / 86400000);
}

function notFound(msg: string): never {
  throw new StaticApiError(404, msg);
}

function unprocessable(msg: string): never {
  throw new StaticApiError(422, msg);
}

function serverOnly(cosa: string): never {
  throw new StaticApiError(
    501,
    `${cosa} non è disponibile nella versione statica (serve il server). Usa l'app completa.`,
  );
}

// ---------------------------------------------------------------- normalizzazione

function conScadenza(p: Preventivo): Preventivo {
  const emissione = (p.data_emissione || "").slice(0, 10);
  if (!emissione) return { ...p, data_scadenza: "", giorni_alla_scadenza: 0, scaduto: false };
  const scadenza = addDays(emissione, p.validita_giorni || 0);
  const residui = daysBetween(todayIso(), scadenza);
  return {
    ...p,
    data_scadenza: scadenza,
    giorni_alla_scadenza: residui,
    scaduto: p.stato === "inviato" && residui < 0,
  };
}

function upsertCliente(
  db: DbShape,
  nome: string,
  extra: Partial<Pick<Cliente, "telefono" | "email" | "indirizzo" | "piva">>,
): void {
  const pulito = (nome || "").trim();
  if (!pulito) return;
  const esistente = db.clienti.find((c) => c.nome.toLowerCase() === pulito.toLowerCase());
  if (!esistente) {
    db.clienti.push({
      id: uid(),
      nome: pulito,
      telefono: extra.telefono ?? "",
      email: extra.email ?? "",
      indirizzo: extra.indirizzo ?? "",
      piva: extra.piva ?? "",
      note: "",
      created_at: nowIso(),
    });
    return;
  }
  for (const campo of ["telefono", "email", "indirizzo", "piva"] as const) {
    const valore = extra[campo];
    if (valore && !esistente[campo]) esistente[campo] = valore;
  }
}

// ---------------------------------------------------------------- lavori

function nuovoLavoro(body: Record<string, unknown>): Lavoro {
  const b = body as Partial<Lavoro>;
  return {
    id: uid(),
    titolo: String(b.titolo ?? ""),
    cliente_nome: String(b.cliente_nome ?? ""),
    cliente_telefono: String(b.cliente_telefono ?? ""),
    cliente_indirizzo: String(b.cliente_indirizzo ?? ""),
    descrizione: String(b.descrizione ?? ""),
    stato: b.stato ?? "da_iniziare",
    data_inizio: String(b.data_inizio ?? ""),
    data_fine_prevista: String(b.data_fine_prevista ?? ""),
    prezzo_pattuito: Number(b.prezzo_pattuito ?? 0),
    ore_manodopera: Number(b.ore_manodopera ?? 0),
    note: String(b.note ?? ""),
    materiali_usati: [],
    ore_lavorate: [],
    lista_spesa: [],
    created_at: nowIso(),
  };
}

function getLavoro(db: DbShape, id: string): Lavoro {
  return db.lavori.find((l) => l.id === id) ?? notFound("Lavoro non trovato");
}

function listaSpesaUnica(db: DbShape): ListaSpesaUnica {
  const righe = new Map<string, RigaSpesa>();
  const cantieri = new Set<string>();
  for (const lavoro of db.lavori.filter((l) => l.stato !== "completato")) {
    for (const item of lavoro.lista_spesa ?? []) {
      if (item.comprato || item.quantita <= 0) continue;
      cantieri.add(lavoro.id);
      const chiave = item.materiale_id || `libero:${item.nome.trim().toLowerCase()}`;
      let riga = righe.get(chiave);
      if (!riga) {
        const mat = db.materiali.find((m) => m.id === item.materiale_id);
        riga = {
          chiave,
          materiale_id: item.materiale_id,
          nome: mat ? mat.nome : item.nome,
          unita: item.unita || "pz",
          quantita_richiesta: 0,
          giacenza: mat ? mat.quantita_disponibile : null,
          mancante: 0,
          prezzo_stimato: item.prezzo_stimato || 0,
          costo_stimato: 0,
          cantieri: [],
        };
        righe.set(chiave, riga);
      }
      riga.quantita_richiesta = r2(riga.quantita_richiesta + item.quantita);
      if (!riga.prezzo_stimato) riga.prezzo_stimato = item.prezzo_stimato || 0;
      riga.cantieri.push({
        lavoro_id: lavoro.id,
        titolo: lavoro.titolo,
        cliente_nome: lavoro.cliente_nome,
        quantita: item.quantita,
      });
    }
  }
  const ordinate = [...righe.values()].map((riga) => {
    const disponibile = riga.giacenza ?? 0;
    const mancante = r2(Math.max(0, riga.quantita_richiesta - disponibile));
    return { ...riga, mancante, costo_stimato: r2(mancante * riga.prezzo_stimato) };
  });
  ordinate.sort((a, b) => b.mancante - a.mancante || a.nome.localeCompare(b.nome));
  return {
    righe: ordinate,
    cantieri_aperti: cantieri.size,
    totale_stimato: r2(ordinate.reduce((s, r) => s + r.costo_stimato, 0)),
  };
}

// ---------------------------------------------------------------- preventivi

function prossimoNumero(db: DbShape): string {
  const prefix = `P-${todayIso().slice(0, 4)}-`;
  const seqs = db.preventivi
    .filter((p) => p.numero.startsWith(prefix))
    .map((p) => Number(p.numero.split("-").pop()) || 0);
  return `${prefix}${String(Math.max(0, ...seqs) + 1).padStart(4, "0")}`;
}

function buildPreventivo(
  body: Record<string, unknown>,
  numero: string,
  base?: Preventivo,
): Preventivo {
  const b = body as {
    cliente_nome?: string;
    cliente_telefono?: string;
    cliente_email?: string;
    cliente_indirizzo?: string;
    cliente_piva?: string;
    titolo_intervento?: string;
    data_emissione?: string;
    validita_giorni?: number;
    voci_materiali?: Omit<VoceMateriale, "id" | "subtotale">[];
    voci_manodopera?: Omit<VoceManodopera, "id" | "subtotale">[];
    sconto_percentuale?: number;
    aliquota_iva?: number;
    note_condizioni?: string;
  };
  const voci_materiali: VoceMateriale[] = (b.voci_materiali ?? []).map((v) => ({
    id: uid(),
    materiale_id: v.materiale_id ?? "",
    nome: v.nome,
    quantita: r2(v.quantita),
    unita: v.unita ?? "pz",
    prezzo_unitario: v.prezzo_unitario ?? 0,
    subtotale: r2(v.quantita * (v.prezzo_unitario ?? 0)),
  }));
  const voci_manodopera: VoceManodopera[] = (b.voci_manodopera ?? []).map((v) => ({
    id: uid(),
    descrizione: v.descrizione,
    ore: r2(v.ore),
    tariffa_oraria: v.tariffa_oraria,
    subtotale: r2(v.ore * v.tariffa_oraria),
    lavoro_id: v.lavoro_id ?? "",
    ore_entry_id: v.ore_entry_id ?? "",
  }));
  const lordo = r2(
    voci_materiali.reduce((s, v) => s + v.subtotale, 0) +
      voci_manodopera.reduce((s, v) => s + v.subtotale, 0),
  );
  const sconto = b.sconto_percentuale ?? 0;
  const aliquota = b.aliquota_iva ?? 22;
  const imponibile = r2(lordo - r2((lordo * sconto) / 100));
  const iva = r2((imponibile * aliquota) / 100);
  return conScadenza({
    id: base?.id ?? uid(),
    numero,
    data_emissione: b.data_emissione || todayIso(),
    validita_giorni: b.validita_giorni ?? 30,
    cliente_nome: b.cliente_nome ?? "",
    cliente_telefono: b.cliente_telefono ?? "",
    cliente_email: b.cliente_email ?? "",
    cliente_indirizzo: b.cliente_indirizzo ?? "",
    cliente_piva: b.cliente_piva ?? "",
    titolo_intervento: b.titolo_intervento ?? "",
    voci_materiali,
    voci_manodopera,
    sconto_percentuale: sconto,
    aliquota_iva: aliquota,
    totale_imponibile: imponibile,
    totale_iva: iva,
    totale_preventivo: r2(imponibile + iva),
    stato: base?.stato ?? "bozza",
    note_condizioni: b.note_condizioni ?? "",
    lavoro_id: base?.lavoro_id ?? "",
    data_scadenza: "",
    giorni_alla_scadenza: 0,
    scaduto: false,
    email_inviata_a: base?.email_inviata_a ?? "",
    data_invio_email: base?.data_invio_email ?? "",
    pdf_token: base?.pdf_token ?? uid().replace(/-/g, ""),
    created_at: base?.created_at ?? nowIso(),
  });
}

function syncOre(db: DbShape, preventivoId: string, voci: VoceManodopera[]): void {
  const attesi = new Set(voci.map((v) => v.ore_entry_id).filter(Boolean));
  for (const lavoro of db.lavori) {
    lavoro.ore_lavorate = (lavoro.ore_lavorate ?? []).map((e: OraLavorata) => {
      if (attesi.has(e.id)) return { ...e, preventivo_id: preventivoId };
      if (e.preventivo_id === preventivoId) return { ...e, preventivo_id: "" };
      return e;
    });
  }
}

// ---------------------------------------------------------------- dashboard

function dashboard(db: DbShape): DashboardStats {
  const preventivi = db.preventivi.map(conScadenza);
  const mese = monthIso();
  let ore_mese = 0;
  let valore_ore_mese = 0;
  const per_lavoro: OrePerLavoro[] = [];
  for (const lavoro of db.lavori) {
    const voci = (lavoro.ore_lavorate ?? []).filter((e) => e.data.startsWith(mese));
    if (voci.length === 0) continue;
    const ore = r2(voci.reduce((s, e) => s + e.ore, 0));
    const valore = r2(voci.reduce((s, e) => s + e.ore * e.tariffa_oraria, 0));
    ore_mese += ore;
    valore_ore_mese += valore;
    per_lavoro.push({
      lavoro_id: lavoro.id,
      titolo: lavoro.titolo,
      cliente_nome: lavoro.cliente_nome,
      ore,
      valore,
    });
  }
  ore_mese = r2(ore_mese);
  valore_ore_mese = r2(valore_ore_mese);
  return {
    lavori_da_iniziare: db.lavori.filter((l) => l.stato === "da_iniziare").length,
    lavori_in_corso: db.lavori.filter((l) => l.stato === "in_corso").length,
    lavori_completati: db.lavori.filter((l) => l.stato === "completato").length,
    preventivi_in_attesa: preventivi.filter((p) => p.stato === "inviato").length,
    valore_preventivi_attesa: r2(
      preventivi.filter((p) => p.stato === "inviato").reduce((s, p) => s + p.totale_preventivo, 0),
    ),
    fatturato_completato: r2(
      db.lavori.filter((l) => l.stato === "completato").reduce((s, l) => s + l.prezzo_pattuito, 0),
    ),
    valore_magazzino: r2(
      db.materiali.reduce((s, m) => s + m.quantita_disponibile * m.prezzo_costo, 0),
    ),
    clienti_totali: db.clienti.length,
    mese_corrente: mese,
    ore_mese,
    valore_ore_mese,
    tariffa_media_mese: ore_mese ? r2(valore_ore_mese / ore_mese) : 0,
    ore_mese_per_lavoro: per_lavoro.sort((a, b) => b.ore - a.ore),
    materiali_sotto_scorta: db.materiali
      .filter((m) => m.quantita_disponibile <= m.scorta_minima)
      .sort(
        (a, b) =>
          a.quantita_disponibile - a.scorta_minima - (b.quantita_disponibile - b.scorta_minima),
      ),
    ultimi_lavori: [...db.lavori]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5),
    preventivi_recenti: [...preventivi]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5),
    preventivi_scaduti: preventivi
      .filter((p) => p.scaduto)
      .sort((a, b) => a.data_scadenza.localeCompare(b.data_scadenza)),
  };
}

// ---------------------------------------------------------------- router locale

/** Instrada method+path sullo store locale, come farebbe FastAPI. */
export function staticRequest<T>(method: string, path: string, body?: unknown): T {
  const db = load();
  const b = (body ?? {}) as Record<string, unknown>;
  const seg = path.replace(/^\//, "").split("?")[0].split("/");
  const [risorsa, ...resto] = seg;
  const commit = <R,>(value: R): R => {
    save(db);
    return value;
  };

  if (risorsa === "dashboard") return dashboard(db) as T;

  // ---------------- clienti
  if (risorsa === "clienti") {
    const [id] = resto;
    if (method === "GET")
      return [...db.clienti].sort((a, b) => a.nome.localeCompare(b.nome)) as T;
    if (method === "POST") {
      const nome = String(b.nome ?? "").trim();
      if (!nome) unprocessable("Il nome del cliente è obbligatorio");
      if (db.clienti.some((c) => c.nome.toLowerCase() === nome.toLowerCase()))
        throw new StaticApiError(409, "Esiste già un cliente con questo nome");
      const cliente: Cliente = {
        id: uid(),
        nome,
        telefono: String(b.telefono ?? ""),
        email: String(b.email ?? ""),
        indirizzo: String(b.indirizzo ?? ""),
        piva: String(b.piva ?? ""),
        note: String(b.note ?? ""),
        created_at: nowIso(),
      };
      db.clienti.push(cliente);
      return commit(cliente as T);
    }
    if (method === "PUT") {
      const cliente = db.clienti.find((c) => c.id === id) ?? notFound("Cliente non trovato");
      Object.assign(cliente, {
        nome: String(b.nome ?? cliente.nome).trim() || cliente.nome,
        telefono: String(b.telefono ?? ""),
        email: String(b.email ?? ""),
        indirizzo: String(b.indirizzo ?? ""),
        piva: String(b.piva ?? ""),
        note: String(b.note ?? ""),
      });
      return commit(cliente as T);
    }
    if (method === "DELETE") {
      if (!db.clienti.some((c) => c.id === id)) notFound("Cliente non trovato");
      db.clienti = db.clienti.filter((c) => c.id !== id);
      return commit(undefined as T);
    }
  }

  // ---------------- materiali
  if (risorsa === "materiali") {
    const [id, sub] = resto;
    if (method === "GET" && !id)
      return [...db.materiali].sort((a, b) => a.nome.localeCompare(b.nome)) as T;
    if (method === "POST" && !id) {
      const materiale: Materiale = {
        id: uid(),
        codice_art: String(b.codice_art ?? ""),
        nome: String(b.nome ?? ""),
        categoria: String(b.categoria ?? ""),
        unita_misura: (b.unita_misura as Materiale["unita_misura"]) ?? "pz",
        prezzo_unitario: Number(b.prezzo_unitario ?? 0),
        prezzo_costo: Number(b.prezzo_costo ?? 0),
        quantita_disponibile: Number(b.quantita_disponibile ?? 0),
        scorta_minima: Number(b.scorta_minima ?? 0),
        fornitore: String(b.fornitore ?? ""),
        created_at: nowIso(),
      };
      if (!materiale.nome) unprocessable("Il nome del materiale è obbligatorio");
      db.materiali.push(materiale);
      return commit(materiale as T);
    }
    if (method === "POST" && id === "import") serverOnly("L'importazione del listino Excel");
    if (method === "POST" && id === "ricarico-prezzi") {
      const categoria = String(b.categoria ?? "tutte");
      const percentuale = Number(b.percentuale ?? 0);
      const applica = String(b.applica_a ?? "vendita");
      const arrotonda = Boolean(b.arrotonda);
      if (!percentuale) unprocessable("Indica una percentuale diversa da zero");
      const target =
        categoria === "tutte"
          ? db.materiali
          : db.materiali.filter((m) => m.categoria.toLowerCase() === categoria.toLowerCase());
      if (target.length === 0) notFound("Nessun materiale in questa categoria");
      const fattore = 1 + percentuale / 100;
      const arr = (v: number) => (arrotonda ? Math.round(v * 20) / 20 : r2(v));
      for (const m of target) {
        if (applica === "vendita" || applica === "entrambi")
          m.prezzo_unitario = arr(m.prezzo_unitario * fattore);
        if (applica === "costo" || applica === "entrambi")
          m.prezzo_costo = arr(m.prezzo_costo * fattore);
      }
      return commit({
        aggiornati: target.length,
        categoria,
        percentuale,
        applica_a: applica,
        esempi: target.slice(0, 5).map((m) => ({
          nome: m.nome,
          prezzo_unitario: m.prezzo_unitario,
          prezzo_costo: m.prezzo_costo,
        })),
      } as T);
    }
    if (method === "POST" && id === "carico-multiplo") {
      const righe = (b.righe ?? []) as { materiale_id: string; quantita: number }[];
      const valide = righe.filter((r) => Number(r.quantita) > 0);
      if (valide.length === 0) unprocessable("Nessuna quantità da caricare");
      let pezzi = 0;
      let valore = 0;
      const nomi: string[] = [];
      for (const riga of valide) {
        const m = db.materiali.find((x) => x.id === riga.materiale_id);
        if (!m) continue;
        m.quantita_disponibile = r2(m.quantita_disponibile + Number(riga.quantita));
        pezzi += Number(riga.quantita);
        valore += Number(riga.quantita) * m.prezzo_costo;
        nomi.push(m.nome);
      }
      if (nomi.length === 0) notFound("Nessun materiale valido da caricare");
      return commit({
        aggiornati: nomi.length,
        pezzi_totali: r2(pezzi),
        valore_carico: r2(valore),
        materiali: nomi,
      } as T);
    }
    const materiale = id ? db.materiali.find((m) => m.id === id) : undefined;
    if (method === "PUT" && id) {
      const m = materiale ?? notFound("Materiale non trovato");
      Object.assign(m, {
        codice_art: String(b.codice_art ?? ""),
        nome: String(b.nome ?? m.nome),
        categoria: String(b.categoria ?? m.categoria),
        unita_misura: (b.unita_misura as Materiale["unita_misura"]) ?? m.unita_misura,
        prezzo_unitario: Number(b.prezzo_unitario ?? 0),
        prezzo_costo: Number(b.prezzo_costo ?? 0),
        quantita_disponibile: Number(b.quantita_disponibile ?? 0),
        scorta_minima: Number(b.scorta_minima ?? 0),
        fornitore: String(b.fornitore ?? ""),
      });
      return commit(m as T);
    }
    if (method === "PATCH" && sub === "stock") {
      const m = materiale ?? notFound("Materiale non trovato");
      m.quantita_disponibile = r2(m.quantita_disponibile + Number(b.delta ?? 0));
      return commit(m as T);
    }
    if (method === "DELETE" && id) {
      if (!materiale) notFound("Materiale non trovato");
      db.materiali = db.materiali.filter((m) => m.id !== id);
      return commit(undefined as T);
    }
  }

  // ---------------- lavori
  if (risorsa === "lavori") {
    const [id, sub, subId] = resto;
    if (method === "GET" && id === "lista-spesa") return listaSpesaUnica(db) as T;
    if (method === "GET" && !id)
      return [...db.lavori].sort((a, b) => b.created_at.localeCompare(a.created_at)) as T;
    if (method === "POST" && !id) {
      const lavoro = nuovoLavoro(b);
      if (!lavoro.titolo) unprocessable("Il titolo del lavoro è obbligatorio");
      db.lavori.push(lavoro);
      upsertCliente(db, lavoro.cliente_nome, {
        telefono: lavoro.cliente_telefono,
        indirizzo: lavoro.cliente_indirizzo,
      });
      return commit(lavoro as T);
    }
    if (method === "GET" && id) return getLavoro(db, id) as T;
    if (method === "PUT" && id) {
      const lavoro = getLavoro(db, id);
      Object.assign(lavoro, {
        titolo: String(b.titolo ?? lavoro.titolo),
        cliente_nome: String(b.cliente_nome ?? lavoro.cliente_nome),
        cliente_telefono: String(b.cliente_telefono ?? ""),
        cliente_indirizzo: String(b.cliente_indirizzo ?? ""),
        descrizione: String(b.descrizione ?? ""),
        stato: (b.stato as Lavoro["stato"]) ?? lavoro.stato,
        data_inizio: String(b.data_inizio ?? ""),
        data_fine_prevista: String(b.data_fine_prevista ?? ""),
        prezzo_pattuito: Number(b.prezzo_pattuito ?? 0),
        ore_manodopera: Number(b.ore_manodopera ?? 0),
        note: String(b.note ?? ""),
      });
      upsertCliente(db, lavoro.cliente_nome, {
        telefono: lavoro.cliente_telefono,
        indirizzo: lavoro.cliente_indirizzo,
      });
      return commit(lavoro as T);
    }
    if (method === "PATCH" && sub === "stato") {
      const lavoro = getLavoro(db, id);
      lavoro.stato = b.stato as Lavoro["stato"];
      return commit(lavoro as T);
    }
    if (method === "POST" && sub === "materiali") {
      const lavoro = getLavoro(db, id);
      const m =
        db.materiali.find((x) => x.id === String(b.materiale_id)) ??
        notFound("Materiale non trovato");
      const quantita = r2(Number(b.quantita ?? 0));
      if (quantita <= 0) unprocessable("La quantità deve essere maggiore di zero");
      lavoro.materiali_usati.push({
        id: uid(),
        materiale_id: m.id,
        nome: m.nome,
        quantita,
        unita: m.unita_misura,
        prezzo_unitario: m.prezzo_unitario,
      });
      m.quantita_disponibile = r2(m.quantita_disponibile - quantita);
      return commit(lavoro as T);
    }
    if (method === "DELETE" && sub === "materiali") {
      const lavoro = getLavoro(db, id);
      const voce =
        lavoro.materiali_usati.find((u) => u.id === subId) ?? notFound("Voce non trovata");
      lavoro.materiali_usati = lavoro.materiali_usati.filter((u) => u.id !== subId);
      const m = db.materiali.find((x) => x.id === voce.materiale_id);
      if (m) m.quantita_disponibile = r2(m.quantita_disponibile + voce.quantita);
      return commit(lavoro as T);
    }
    if (method === "POST" && sub === "ore") {
      const lavoro = getLavoro(db, id);
      const ore = r2(Number(b.ore ?? 0));
      if (ore <= 0) unprocessable("Le ore devono essere maggiori di zero");
      lavoro.ore_lavorate.push({
        id: uid(),
        data: String(b.data || todayIso()),
        ore,
        tariffa_oraria: Number(b.tariffa_oraria ?? 0),
        descrizione: String(b.descrizione ?? ""),
        preventivo_id: "",
      });
      return commit(lavoro as T);
    }
    if (method === "DELETE" && sub === "ore") {
      const lavoro = getLavoro(db, id);
      const voce =
        lavoro.ore_lavorate.find((e) => e.id === subId) ?? notFound("Voce ore non trovata");
      if (voce.preventivo_id)
        throw new StaticApiError(
          400,
          "Ora già inclusa in un preventivo: rimuovila prima da lì",
        );
      lavoro.ore_lavorate = lavoro.ore_lavorate.filter((e) => e.id !== subId);
      return commit(lavoro as T);
    }
    if (sub === "lista") {
      const lavoro = getLavoro(db, id);
      if (method === "POST") {
        const quantita = r2(Number(b.quantita ?? 0));
        if (quantita <= 0) unprocessable("La quantità deve essere maggiore di zero");
        const materialeId = String(b.materiale_id ?? "");
        let nome = String(b.nome ?? "").trim();
        let unita = String(b.unita ?? "pz");
        let prezzo = Number(b.prezzo_stimato ?? 0);
        if (materialeId) {
          const m =
            db.materiali.find((x) => x.id === materialeId) ?? notFound("Materiale non trovato");
          nome = nome || m.nome;
          unita = m.unita_misura;
          if (!prezzo) prezzo = m.prezzo_costo || m.prezzo_unitario;
        }
        if (!nome) unprocessable("Indica un materiale o una descrizione");
        const item: ListaItem = {
          id: uid(),
          materiale_id: materialeId,
          nome,
          quantita,
          unita,
          prezzo_stimato: r2(prezzo),
          comprato: false,
          caricato: false,
          note: String(b.note ?? ""),
        };
        lavoro.lista_spesa = [...(lavoro.lista_spesa ?? []), item];
        return commit(lavoro as T);
      }
      const item =
        (lavoro.lista_spesa ?? []).find((i) => i.id === subId) ??
        notFound("Voce della lista non trovata");
      if (method === "PATCH") {
        const materiale = item.materiale_id
          ? db.materiali.find((m) => m.id === item.materiale_id)
          : undefined;
        if (b.quantita !== undefined && b.quantita !== null) {
          const q = r2(Number(b.quantita));
          if (q <= 0) unprocessable("La quantità deve essere maggiore di zero");
          if (b.comprato === undefined && item.caricato && materiale)
            materiale.quantita_disponibile = r2(
              materiale.quantita_disponibile + (q - item.quantita),
            );
          item.quantita = q;
        }
        if (b.nome !== undefined && b.nome !== null) {
          const nome = String(b.nome).trim();
          if (!nome) unprocessable("La descrizione non può essere vuota");
          item.nome = nome;
        }
        if (b.unita !== undefined && b.unita !== null) item.unita = String(b.unita);
        if (b.prezzo_stimato !== undefined && b.prezzo_stimato !== null)
          item.prezzo_stimato = Number(b.prezzo_stimato);
        if (b.note !== undefined && b.note !== null) item.note = String(b.note);
        if (b.comprato !== undefined && b.comprato !== null) {
          const comprato = Boolean(b.comprato);
          if (materiale) {
            if (comprato && !item.caricato) {
              materiale.quantita_disponibile = r2(
                materiale.quantita_disponibile + item.quantita,
              );
              item.caricato = true;
            } else if (!comprato && item.caricato) {
              materiale.quantita_disponibile = r2(
                materiale.quantita_disponibile - item.quantita,
              );
              item.caricato = false;
            }
          }
          item.comprato = comprato;
        }
        return commit(lavoro as T);
      }
      if (method === "DELETE") {
        lavoro.lista_spesa = (lavoro.lista_spesa ?? []).filter((i) => i.id !== subId);
        return commit(lavoro as T);
      }
    }
    if (method === "DELETE" && id && !sub) {
      if (!db.lavori.some((l) => l.id === id)) notFound("Lavoro non trovato");
      db.lavori = db.lavori.filter((l) => l.id !== id);
      return commit(undefined as T);
    }
  }

  // ---------------- preventivi
  if (risorsa === "preventivi") {
    const [id, sub] = resto;
    if (method === "GET" && !id)
      return [...db.preventivi]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(conScadenza) as T;
    if (method === "POST" && !id) {
      const preventivo = buildPreventivo(b, prossimoNumero(db));
      db.preventivi.push(preventivo);
      syncOre(db, preventivo.id, preventivo.voci_manodopera);
      upsertCliente(db, preventivo.cliente_nome, {
        telefono: preventivo.cliente_telefono,
        email: preventivo.cliente_email,
        indirizzo: preventivo.cliente_indirizzo,
        piva: preventivo.cliente_piva,
      });
      return commit(preventivo as T);
    }
    const esistente = id ? db.preventivi.find((p) => p.id === id) : undefined;
    if (method === "GET" && id)
      return conScadenza(esistente ?? notFound("Preventivo non trovato")) as T;
    if (method === "PUT" && id) {
      const base = esistente ?? notFound("Preventivo non trovato");
      if (base.lavoro_id)
        throw new StaticApiError(400, "Il preventivo è già stato convertito in lavoro");
      const aggiornato = buildPreventivo(b, base.numero, base);
      db.preventivi = db.preventivi.map((p) => (p.id === id ? aggiornato : p));
      syncOre(db, id, aggiornato.voci_manodopera);
      upsertCliente(db, aggiornato.cliente_nome, {
        telefono: aggiornato.cliente_telefono,
        email: aggiornato.cliente_email,
        indirizzo: aggiornato.cliente_indirizzo,
        piva: aggiornato.cliente_piva,
      });
      return commit(aggiornato as T);
    }
    if (method === "PATCH" && sub === "stato") {
      const p = esistente ?? notFound("Preventivo non trovato");
      p.stato = b.stato as Preventivo["stato"];
      return commit(conScadenza(p) as T);
    }
    if (method === "PATCH" && sub === "rinnova") {
      const p = esistente ?? notFound("Preventivo non trovato");
      p.data_emissione = todayIso();
      p.validita_giorni = Number(b.validita_giorni ?? 30) || 30;
      p.stato = "inviato";
      return commit(conScadenza(p) as T);
    }
    if (method === "POST" && sub === "duplica") {
      const base = esistente ?? notFound("Preventivo non trovato");
      const copia: Preventivo = {
        ...base,
        id: uid(),
        numero: prossimoNumero(db),
        data_emissione: todayIso(),
        stato: "bozza",
        lavoro_id: "",
        email_inviata_a: "",
        data_invio_email: "",
        created_at: nowIso(),
        voci_manodopera: base.voci_manodopera.map((v) => ({
          ...v,
          id: uid(),
          lavoro_id: "",
          ore_entry_id: "",
        })),
      };
      db.preventivi.push(copia);
      return commit(conScadenza(copia) as T);
    }
    if (method === "POST" && sub === "converti") {
      const base = esistente ?? notFound("Preventivo non trovato");
      if (base.stato !== "accettato")
        throw new StaticApiError(
          400,
          "Solo un preventivo accettato può essere convertito in lavoro",
        );
      if (base.lavoro_id) throw new StaticApiError(400, "Preventivo già convertito in lavoro");
      const lavoro = nuovoLavoro({
        titolo: `${base.titolo_intervento} (da ${base.numero})`,
        cliente_nome: base.cliente_nome,
        cliente_telefono: base.cliente_telefono,
        cliente_indirizzo: base.cliente_indirizzo,
        descrizione: base.note_condizioni,
        prezzo_pattuito: base.totale_preventivo,
      });
      lavoro.materiali_usati = base.voci_materiali.map((v) => ({
        id: uid(),
        materiale_id: v.materiale_id,
        nome: v.nome,
        quantita: v.quantita,
        unita: v.unita,
        prezzo_unitario: v.prezzo_unitario,
      }));
      db.lavori.push(lavoro);
      base.lavoro_id = lavoro.id;
      return commit(lavoro as T);
    }
    if (method === "POST" && sub === "invia") serverOnly("L'invio del preventivo per email");
    if (method === "DELETE" && id) {
      if (!esistente) notFound("Preventivo non trovato");
      syncOre(db, id, []);
      db.preventivi = db.preventivi.filter((p) => p.id !== id);
      return commit(undefined as T);
    }
  }

  throw new StaticApiError(404, `Endpoint non disponibile offline: ${method} ${path}`);
}
