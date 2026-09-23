// Formattazione e costanti di dominio in italiano (EUR, date DD/MM/YYYY).
import type { StatoLavoro, StatoPreventivo, UnitaMisura } from "@/lib/types";

export function fmtEuro(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n ?? 0);
}

export function fmtNum(n: number): string {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(n ?? 0);
}

export function fmtDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : "—";
}

export function parseNum(s: string): number {
  return Number(s.replace(",", ".")) || 0;
}

export const STATO_LAVORO_LABELS: Record<StatoLavoro, string> = {
  da_iniziare: "Da iniziare",
  in_corso: "In corso",
  completato: "Completato",
};

export const STATO_PREVENTIVO_LABELS: Record<StatoPreventivo, string> = {
  bozza: "Bozza",
  inviato: "Inviato",
  accettato: "Accettato",
  rifiutato: "Rifiutato",
};

export const CATEGORIE = [
  "Cavi e Conduttori",
  "Magnetotermici e Quadri",
  "Prese e Interruttori",
  "Tubi e Canaline",
  "Illuminazione",
  "Minuteria e Fissaggi",
] as const;

export const UNITA_MISURA: UnitaMisura[] = ["pz", "m", "conf", "rotolo"];

export function waLink(telefono: string): string {
  const digits = telefono.replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits.startsWith("39") ? digits : `39${digits}`}`;
}
