"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/app/form-field";
import { savePromise, togglePromise } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";
import { formatDateTime } from "@/domain/shared/dates";
import { cn } from "@/lib/utils";
import { Section } from "./section";

type Promise_ = { id: string; description: string; due_at: string; done_at: string | null };

/** Promessas comerciais com prazo (RF-FEC-03). */
export function PromisesCard({ clientId, canManage, promises }: { clientId: string; canManage: boolean; promises: Promise_[] }) {
  const [adding, setAdding] = useState(false);
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [pending, startTransition] = useTransition();
  const sorted = [...promises].sort((a, b) => Number(Boolean(a.done_at)) - Number(Boolean(b.done_at)) || a.due_at.localeCompare(b.due_at));
  const now = new Date().toISOString();

  return (
    <Section
      title="Promessas comerciais"
      action={canManage && !adding ? <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus aria-hidden="true" /> Adicionar</Button> : undefined}
    >
      {sorted.length === 0 && !adding && <p className="text-sm text-muted-foreground">Nenhuma promessa registrada no fechamento.</p>}
      {sorted.length > 0 && (
        <ul className="grid gap-2">
          {sorted.map((p) => {
            const late = !p.done_at && p.due_at < now;
            return (
              <li key={p.id} className={cn("flex items-start gap-3 rounded-xl border bg-card p-3", late && "border-danger/40")}>
                <Checkbox
                  id={`prom-${p.id}`}
                  className="mt-0.5"
                  checked={Boolean(p.done_at)}
                  disabled={pending}
                  onCheckedChange={(v) => startTransition(async () => void handleResult(await togglePromise({ id: p.id, clientId, done: v === true })))}
                  aria-label={`Marcar “${p.description}” como cumprida`}
                />
                <label htmlFor={`prom-${p.id}`} className="grid gap-0.5 text-sm">
                  <span className={cn(p.done_at && "text-muted-foreground line-through")}>{p.description}</span>
                  <span className={cn("text-xs", late ? "font-medium text-danger" : "text-muted-foreground")}>
                    {p.done_at ? "Cumprida" : late ? `Atrasada desde ${formatDateTime(p.due_at)}` : `Prazo: ${formatDateTime(p.due_at)}`}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {adding && (
        <div className="grid gap-3 rounded-xl border bg-card p-3">
          <FormField label="Promessa"><Input autoComplete="off" value={desc} onChange={(e) => setDesc(e.target.value)} /></FormField>
          <FormField label="Prazo"><Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></FormField>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || desc.trim().length < 2 || !due}
              onClick={() =>
                startTransition(async () => {
                  if (handleResult(await savePromise({ clientId, description: desc, due_at: new Date(due).toISOString() }))) {
                    setAdding(false);
                    setDesc("");
                    setDue("");
                  }
                })
              }
            >
              {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />} Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </Section>
  );
}
