/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" nella build statica per GitHub Pages (dati in localStorage, nessun backend). */
  readonly VITE_STATIC?: string;
  /** Hash SHA-256 del PIN di accesso; se assente si usa il default in PinLock.tsx. */
  readonly VITE_PIN_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
