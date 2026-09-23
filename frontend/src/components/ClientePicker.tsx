import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Cliente } from "@/lib/types";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClientePickerProps {
  /** Precompila i campi del form con i dati del cliente scelto. */
  onPick: (cliente: Cliente) => void;
  testId: string;
  label?: string;
}

/** Selettore riutilizzabile che ricarica un cliente già salvato in anagrafica. */
export default function ClientePicker({
  onPick,
  testId,
  label = "Carica da anagrafica",
}: ClientePickerProps) {
  const { data: clienti } = useQuery({
    queryKey: ["clienti"],
    queryFn: () => apiGet<Cliente[]>("/clienti"),
  });

  if (!clienti || clienti.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={testId} className="flex items-center gap-1.5 text-slate-400">
        <UserRound size={13} /> {label}
      </Label>
      <Select
        value=""
        onValueChange={(v) => {
          const cliente = clienti.find((c) => c.id === v);
          if (cliente) onPick(cliente);
        }}
      >
        <SelectTrigger id={testId} data-testid={testId} className="w-full">
          <SelectValue>{() => "Seleziona un cliente salvato…"}</SelectValue>
        </SelectTrigger>
        <SelectContent className="border-[#27364F] bg-[#162032]">
          {clienti.map((c) => (
            <SelectItem key={c.id} value={c.id} data-testid={`${testId}-option-${c.id}`}>
              {c.nome}
              {c.indirizzo ? ` — ${c.indirizzo}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
