"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { setRecipients } from "@/features/clients/settings-actions";
import { handleResult } from "@/lib/action-feedback";

export function Recipients({ team, selected }: { team: { id: string; name: string }[]; selected: string[] }) {
  const [ids, setIds] = useState(selected);
  const [pending, startTransition] = useTransition();
  return (
    <section aria-labelledby="dest" className="grid gap-3">
      <div className="grid gap-1">
        <h2 id="dest" className="text-base font-semibold">Quem é avisado de cliente novo</h2>
        <p className="text-sm text-muted-foreground">Sem ninguém marcado, vale o padrão: todas as pessoas com papel Coordenação de conteúdo e Gerente de tráfego.</p>
      </div>
      <div className="grid gap-1 rounded-xl border bg-card p-4 sm:grid-cols-2">
        {team.map((t) => (
          <div key={t.id} className="flex min-h-9 items-center gap-2">
            <Checkbox id={`rec-${t.id}`} checked={ids.includes(t.id)} onCheckedChange={(v) => setIds(v ? [...ids, t.id] : ids.filter((x) => x !== t.id))} />
            <Label htmlFor={`rec-${t.id}`} className="font-normal">{t.name}</Label>
          </div>
        ))}
      </div>
      <Button variant="outline" className="justify-self-start" disabled={pending} onClick={() => startTransition(async () => void handleResult(await setRecipients({ ids })))}>
        {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar destinatários
      </Button>
    </section>
  );
}
