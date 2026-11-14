import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Section } from "@/features/clients/components/section";
import { milestoneState, MILESTONE_STATE_LABEL } from "@/domain/clients/milestones";
import { dayLabel } from "@/domain/trainings";
import type { RunRow } from "@/features/playbooks/queries";
import { cn } from "@/lib/utils";

const TONE = { concluido: "text-success", atrasado: "font-medium text-danger", no_prazo: "text-muted-foreground", sem_prazo: "text-muted-foreground" } as const;

/** Playbooks aplicados ao cliente, com os marcos e a situação de cada um. */
export function ClientRuns({ runs, today, canApply }: { runs: RunRow[]; today: string; canApply: boolean }) {
  if (!runs.length && !canApply) return null;
  return (
    <Section title="Playbooks" action={canApply ? <Link href="/playbooks" className="text-sm font-medium text-primary hover:underline">Aplicar um playbook</Link> : undefined}>
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum playbook aplicado a este cliente.</p>
      ) : (
        <ul className="grid gap-3">
          {runs.map((r) => {
            const done = r.milestones.filter((m) => m.doneAt).length;
            return (
              <li key={r.id} className="grid gap-2 rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground tabular">início {dayLabel(r.startOn)} · {done}/{r.milestones.length} marcos</span>
                </div>
                <ol className="grid gap-1" aria-label={`Marcos de ${r.name}`}>
                  {r.milestones.map((m) => {
                    const st = milestoneState(m.dueOn, m.doneAt, today);
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          {m.doneAt ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" /> : <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                          <span className="truncate">{m.title}</span>
                        </span>
                        <span className={cn("shrink-0 text-xs tabular", TONE[st])}>{MILESTONE_STATE_LABEL[st]}{m.dueOn && !m.doneAt ? ` · até ${dayLabel(m.dueOn)}` : ""}</span>
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
