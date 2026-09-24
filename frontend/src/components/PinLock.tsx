import { useEffect, useState, type ReactNode } from "react";
import { Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Hash SHA-256 del PIN: nel codice non c'è mai il PIN in chiaro. Si può
// sovrascrivere a build time con VITE_PIN_HASH (vedi GITHUB.md).
const PIN_HASH =
  import.meta.env.VITE_PIN_HASH ||
  "744b93f9950fc38dad705556931ea48193b99dcb191cc9bd77097f65fbe2f0b8";

const SESSION_KEY = "voltcraft.unlocked";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface PinLockProps {
  children: ReactNode;
}

/** Schermata di blocco all'apertura: sblocca l'app per la sessione del browser. */
export default function PinLock({ children }: PinLockProps) {
  const [sbloccato, setSbloccato] = useState(false);
  const [pin, setPin] = useState("");
  const [errore, setErrore] = useState("");
  const [verifica, setVerifica] = useState(false);

  useEffect(() => {
    setSbloccato(sessionStorage.getItem(SESSION_KEY) === "1");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifica(true);
    const ok = (await sha256(pin.trim())) === PIN_HASH;
    setVerifica(false);
    if (!ok) {
      setErrore("PIN errato, riprova.");
      setPin("");
      return;
    }
    sessionStorage.setItem(SESSION_KEY, "1");
    setSbloccato(true);
  };

  if (sbloccato) return <>{children}</>;

  return (
    <div
      data-testid="pin-lock-screen"
      className="flex min-h-svh items-center justify-center bg-[#0B0F17] px-4"
    >
      <form
        onSubmit={submit}
        data-testid="pin-lock-form"
        className="w-full max-w-sm rounded-2xl border border-[#1E293B] bg-[#111827] p-7 shadow-2xl"
      >
        <span className="relative mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-black">
          <Zap size={24} strokeWidth={2.5} />
          <span className="absolute inset-0 rounded-xl bg-amber-500/40 blur-md" aria-hidden />
        </span>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-100">
          VoltCraft Elettrica
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Inserisci il PIN per accedere ai tuoi lavori, materiali e preventivi.
        </p>

        <div className="mt-6 space-y-1.5">
          <Label htmlFor="pin-input">PIN di accesso</Label>
          <Input
            id="pin-input"
            data-testid="pin-lock-input"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setErrore("");
            }}
            placeholder="••••"
            className="text-center font-mono text-lg tracking-[0.4em]"
          />
        </div>

        {errore && (
          <p data-testid="pin-lock-error" className="mt-3 text-sm text-red-400">
            {errore}
          </p>
        )}

        <Button
          type="submit"
          data-testid="pin-lock-submit"
          disabled={verifica || pin.trim().length === 0}
          className="mt-5 min-h-11 w-full bg-amber-500 text-black hover:bg-amber-600"
        >
          <Lock size={16} /> {verifica ? "Verifico…" : "Sblocca"}
        </Button>

        <p className="mt-4 text-xs text-slate-500">
          Il PIN resta valido fino alla chiusura del browser. I dati della versione statica
          restano solo su questo dispositivo.
        </p>
      </form>
    </div>
  );
}
