"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { addChecklist, deleteChecklist, toggleChecklist } from "@/features/tasks/actions";
import { handleResult } from "@/lib/action-feedback";
import { Section } from "@/features/clients/components/section";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; done_at: string | null };

export function TaskChecklist({ taskId, items, canEdit }: { taskId: string; items: Item[]; canEdit: boolean }) {
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const done = items.filter((i) => i.done_at).length;
  const run = (p: Promise<{ ok: boolean; message?: string }>) => startTransition(async () => void handleResult((await p) as never));
  return (
    <Section title={items.length ? `Checklist (${done}/${items.length})` : "Checklist"}>
      {items.length > 0 && (
        <ul className="grid gap-1 rounded-xl border bg-card p-2">
          {items.map((i) => (
            <li key={i.id} className="flex min-h-10 items-center gap-3 rounded-md px-2 hover:bg-muted/50">
              <Checkbox id={`tc-${i.id}`} checked={Boolean(i.done_at)} disabled={!canEdit || pending} onCheckedChange={(v) => run(toggleChecklist({ id: i.id, taskId, done: v === true }))} />
              <label htmlFor={`tc-${i.id}`} className={cn("flex-1 text-sm", i.done_at && "text-muted-foreground line-through")}>{i.title}</label>
              {canEdit && (
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Remover ${i.title}`} onClick={() => run(deleteChecklist({ id: i.id, taskId }))}><X /></Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              if (handleResult(await addChecklist({ taskId, title }))) setTitle("");
            });
          }}
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Novo item…" aria-label="Novo item do checklist" autoComplete="off" />
          <Button type="submit" variant="outline" disabled={pending || !title.trim()}><Plus aria-hidden="true" /> Adicionar</Button>
        </form>
      )}
    </Section>
  );
}
