"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addChecklistItem } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";
import { dayLabel } from "@/domain/trainings";
import { MILESTONE_KEYS, MILESTONE_STATE_LABEL, milestoneState } from "@/domain/clients/milestones";
import { Section } from "@/features/clients/components/section";
import { cn } from "@/lib/utils";
import { ChecklistRow, type ChecklistItem } from "./checklist-row";

type Milestone = { key: string; title: string; due_on: string | null; done_at: string | null };

const TONE = { concluido: "text-success", atrasado: "font-medium text-danger", no_prazo: "text-muted-foreground", sem_prazo: "text-muted-foreground" } as const;

/** Passos do onboarding agrupados pelos marcos do Miro, com responsável, prazo e orientação. */
export function Checklist({
  clientId,
  items,
  milestones,
  team,
  canManage,
  userId,
  today,
}: {
  clientId: string;
  items: ChecklistItem[];
  milestones: Milestone[];
  team: { id: string; name: string }[];
  canManage: boolean;
  userId: string;
  today: string;
}) {
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const done = items.filter((i) => i.doneAt).length;
  const groups = [
    ...MILESTONE_KEYS.map((k) => ({ key: k, milestone: milestones.find((m) => m.key === k), items: items.filter((i) => i.milestone === k) })),
    { key: "outros", milestone: undefined, items: items.filter((i) => !i.milestone || !MILESTONE_KEYS.includes(i.milestone as never)) },
  ].filter((g) => g.items.length > 0);
  const final = milestones.find((m) => m.key === "conclusao");

  return (
    <Section title={`Passos do onboarding (${done}/${items.length})`}>
      <ol className="grid gap-5" aria-label="Marcos do onboarding">
        {groups.map((g) => {
          const state = g.milestone ? milestoneState(g.milestone.due_on, g.milestone.done_at, today) : null;
          return (
            <li key={g.key} className="grid gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  {state === "concluido" ? <CheckCircle2 className="size-4 text-success" aria-hidden="true" /> : <Circle className="size-4 text-muted-foreground" aria-hidden="true" />}
                  {g.milestone?.title ?? "Outros passos"}
                </h3>
                {g.milestone && state && (
                  <span className={cn("text-xs tabular", TONE[state])}>
                    {MILESTONE_STATE_LABEL[state]}
                    {g.milestone.due_on && state !== "concluido" ? ` · até ${dayLabel(g.milestone.due_on)}` : ""}
                  </span>
                )}
              </div>
              <ul className="grid gap-2">
                {g.items.map((i) => (
                  <ChecklistRow key={i.id} item={i} team={team} canManage={canManage} editable={canManage || i.assigneeId === userId} />
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
      {final && (
        <p className={cn("text-xs tabular", TONE[milestoneState(final.due_on, final.done_at, today)])}>
          {final.title}: {MILESTONE_STATE_LABEL[milestoneState(final.due_on, final.done_at, today)]}
          {final.due_on && !final.done_at ? ` · previsto para ${dayLabel(final.due_on)}` : ""}
        </p>
      )}
      {canManage && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              if (handleResult(await addChecklistItem({ clientId, title }))) setTitle("");
            });
          }}
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Outro passo para este cliente…" aria-label="Novo passo do onboarding" autoComplete="off" />
          <Button type="submit" variant="outline" disabled={pending || title.trim().length < 2}><Plus aria-hidden="true" /> Adicionar</Button>
        </form>
      )}
    </Section>
  );
}
