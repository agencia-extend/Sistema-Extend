"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateTask } from "@/features/tasks/actions";
import { handleResult } from "@/lib/action-feedback";
import { Section } from "@/features/clients/components/section";

export function TaskDescription({ id, value, canEdit }: { id: string; value: string; canEdit: boolean }) {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(value);
  const [pending, startTransition] = useTransition();
  const dirty = text !== saved;
  return (
    <Section title="Briefing / descrição">
      {canEdit ? (
        <div className="grid gap-2">
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label="Briefing ou descrição da demanda" placeholder="O que precisa ser feito, referências, tom, CTA…" />
          {dirty && (
            <div className="flex gap-2">
              <Button size="sm" disabled={pending} onClick={() => startTransition(async () => { if (handleResult(await updateTask({ id, description: text }))) setSaved(text); })}>
                {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar descrição
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setText(saved)}>Descartar</Button>
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-xl border bg-card p-4 text-sm whitespace-pre-line">{value || "Sem descrição."}</p>
      )}
    </Section>
  );
}
