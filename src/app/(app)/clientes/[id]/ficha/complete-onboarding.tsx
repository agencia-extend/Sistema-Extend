"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";

/** "Concluir onboarding" só habilita quando tudo está completo (RF-ONB-03). */
export function CompleteOnboarding({ clientId, missing, canComplete }: { clientId: string; missing: string[]; canComplete: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const ready = missing.length === 0;
  return (
    <section aria-labelledby="concluir" className="grid gap-3 rounded-xl border bg-card p-4">
      <h2 id="concluir" className="text-base font-semibold">Concluir onboarding</h2>
      {ready ? (
        <p className="text-sm text-muted-foreground">Tudo preenchido. Ao concluir, o cliente vira ativo, as abas de produção aparecem e as demandas do mês são criadas para os responsáveis.</p>
      ) : (
        <div className="grid gap-1.5">
          <p className="text-sm text-muted-foreground">Falta {missing.length} {missing.length === 1 ? "item" : "itens"}:</p>
          <ul className="grid max-h-56 gap-1 overflow-y-auto text-sm">
            {missing.map((m) => <li key={m} className="flex gap-2"><span className="text-warning" aria-hidden="true">•</span>{m}</li>)}
          </ul>
        </div>
      )}
      {canComplete && (
        <Button
          disabled={!ready || pending}
          onClick={() =>
            startTransition(async () => {
              if (handleResult(await completeOnboarding({ clientId }))) router.push(`/clientes/${clientId}`);
            })
          }
        >
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
          Concluir onboarding
        </Button>
      )}
    </section>
  );
}
