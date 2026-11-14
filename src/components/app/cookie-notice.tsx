"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEY = "extend-cookies-ok";
const EVENT = "extend-cookies";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
};
const readAccepted = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Aviso de cookies das páginas públicas (entrada, política, termos, aprovação do cliente).
 * O sistema só usa cookies necessários; o aceite fica guardado neste aparelho.
 */
export function CookieNotice({ className }: { className?: string }) {
  // No servidor fica escondido (evita piscar); no navegador, aparece até a pessoa aceitar.
  const accepted = useSyncExternalStore(subscribe, readAccepted, () => true);
  const [hidden, setHidden] = useState(false);
  if (accepted || hidden) return null;
  const accept = () => {
    try {
      localStorage.setItem(KEY, "1");
      window.dispatchEvent(new Event(EVENT));
    } catch {
      setHidden(true); // navegação privada: só esconde por agora
    }
  };
  return (
    <section aria-label="Aviso de cookies" className={cn("mx-auto flex w-full max-w-2xl flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card/90 px-4 py-3 text-sm shadow-sm backdrop-blur", className)}>
      <Cookie className="size-4 shrink-0 text-brand" aria-hidden="true" />
      <p className="min-w-0 flex-1 leading-6 text-muted-foreground">
        Usamos só os cookies necessários para manter você conectado com segurança. Nada de publicidade ou rastreamento.{" "}
        <Link href="/privacidade#cookies" className="font-medium text-foreground underline underline-offset-2">Saiba mais</Link>
      </p>
      <Button size="sm" onClick={accept}>Aceitar</Button>
    </section>
  );
}
