"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { handleResult } from "@/lib/action-feedback";
import { acknowledgePolicy } from "@/features/privacy/actions";

/** Aviso no topo do sistema até a pessoa registrar que leu a versão atual da política. */
export function PolicyNotice({ version, updated }: { version: string; updated: string }) {
  const [pending, start] = useTransition();
  return (
    <section aria-label="Aviso de privacidade" className="border-b bg-brand/5 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ShieldCheck className="size-5 shrink-0 text-brand" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm leading-6">
          A Política de Privacidade e os Termos de uso do sistema foram publicados em {updated}. Leia como seus dados são usados e protegidos.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/privacidade" target="_blank">Ler a política</Link>
          </Button>
          <Button size="sm" disabled={pending} onClick={() => start(async () => void handleResult(await acknowledgePolicy({ version })))}>
            Li e entendi
          </Button>
        </div>
      </div>
    </section>
  );
}
