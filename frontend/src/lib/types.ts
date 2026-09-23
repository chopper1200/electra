// Mirror manuale dei modelli Pydantic del backend — nulla inferisce oltre HTTP.

export type StatoLavoro = "da_iniziare" | "in_corso" | "completato";
export type StatoPreventivo = "bozza" | "inviato" | "accettato" | "rifiutato";
export type UnitaMisura = "pz" | "m" | "conf" | "rotolo";

export interface MaterialUsage {
  id: string;
  materiale_id: string;
  nome: string;
  quantita: number;
  unita: string;
  prezzo_unitario: number;
}

export interface OraLavorata {
  id: string;
  data: string;
  ore: number;
  tariffa_oraria: number;
  descrizione: string;
  preventivo_id: string;
}

export interface Lavoro {
  id: string;
  titolo: string;
  cliente_nome: string;
  cliente_telefono: string;
  cliente_indirizzo: string;
  descrizione: string;
  stato: StatoLavoro;
  data_inizio: string;
  data_fine_prevista: string;
  prezzo_pattuito: number;
  ore_manodopera: number;
  note: string;
  materiali_usati: MaterialUsage[];
  ore_lavorate: OraLavorata[];
  created_at: string;
}

export interface LavoroInput {
  titolo: string;
  cliente_nome: string;
  cliente_telefono: string;
  cliente_indirizzo: string;
  descrizione: string;
  stato: StatoLavoro;
  data_inizio: string;
  data_fine_prevista: string;
  prezzo_pattuito: number;
  ore_manodopera: number;
  note: string;
}

export interface Materiale {
  id: string;
  codice_art: string;
  nome: string;
  categoria: string;
  unita_misura: UnitaMisura;
  prezzo_unitario: number;
  prezzo_costo: number;
  quantita_disponibile: number;
  scorta_minima: number;
  fornitore: string;
  created_at: string;
}

export interface MaterialeInput {
  codice_art: string;
  nome: string;
  categoria: string;
  unita_misura: UnitaMisura;
  prezzo_unitario: number;
  prezzo_costo: number;
  quantita_disponibile: number;
  scorta_minima: number;
  fornitore: string;
}

export interface VoceMateriale {
  id: string;
  materiale_id: string;
  nome: string;
  quantita: number;
  unita: string;
  prezzo_unitario: number;
  subtotale: number;
}

export interface VoceManodopera {
  id: string;
  descrizione: string;
  ore: number;
  tariffa_oraria: number;
  subtotale: number;
  lavoro_id?: string;
  ore_entry_id?: string;
}

export interface Preventivo {
  id: string;
  numero: string;
  data_emissione: string;
  validita_giorni: number;
  cliente_nome: string;
  cliente_telefono: string;
  cliente_email: string;
  cliente_indirizzo: string;
  cliente_piva: string;
  titolo_intervento: string;
  voci_materiali: VoceMateriale[];
  voci_manodopera: VoceManodopera[];
  sconto_percentuale: number;
  aliquota_iva: number;
  totale_imponibile: number;
  totale_iva: number;
  totale_preventivo: number;
  stato: StatoPreventivo;
  note_condizioni: string;
  lavoro_id: string;
  created_at: string;
}

export interface PreventivoInput {
  cliente_nome: string;
  cliente_telefono: string;
  cliente_email: string;
  cliente_indirizzo: string;
  cliente_piva: string;
  titolo_intervento: string;
  data_emissione: string;
  validita_giorni: number;
  voci_materiali: {
    materiale_id: string;
    nome: string;
    quantita: number;
    unita: string;
    prezzo_unitario: number;
  }[];
  voci_manodopera: {
    descrizione: string;
    ore: number;
    tariffa_oraria: number;
    lavoro_id?: string;
    ore_entry_id?: string;
  }[];
  sconto_percentuale: number;
  aliquota_iva: number;
  note_condizioni: string;
}

export interface DashboardStats {
  lavori_da_iniziare: number;
  lavori_in_corso: number;
  lavori_completati: number;
  preventivi_in_attesa: number;
  valore_preventivi_attesa: number;
  fatturato_completato: number;
  valore_magazzino: number;
  materiali_sotto_scorta: Materiale[];
  ultimi_lavori: Lavoro[];
  preventivi_recenti: Preventivo[];
}
