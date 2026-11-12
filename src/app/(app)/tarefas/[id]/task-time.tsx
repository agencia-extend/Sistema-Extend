"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startTimer, stopTimer } from "@/features/tasks/actions";
import { handleResult } from "@/lib/action-feedback";
import { formatDuration, totalMs } from "@/domain/tasks";
import { formatDateTime } from "@/domain/shared/dates";
import { Section } from "@/features/clients/components/section";

type Entry = { id: string; started_at: string; ended_at: string | null; profile_id: string; person: string };
type Stage = { id: number; step_name: string; entered_at: string; left_at: string | null; assignee: string | null };

/** Tempo trabalhado (iniciar/pausar) e tempo em cada etapa (RF-TAR-05). */
export function TaskTime({ taskId, running, entries, history }: { taskId: string; running: { taskId: string; startedAt: string; title: string } | null; entries: Entry[]; history: Stage[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());
  const mine = running?.taskId === taskId;
  useEffect(() => {
    if (!mine) return;
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [mine]);

  const byPerson = new Map<string, number>();
  for (const e of entries) byPerson.set(e.person, (byPerson.get(e.person) ?? 0) + totalMs([e], now));
  const total = totalMs(entries, now);

  return (
    <Section title="Tempo">
      <div className="grid gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-heading text-2xl font-semibold tabular">{total ? formatDuration(total) : "0 min"}</p>
            <p className="text-xs text-muted-foreground">trabalhado neste card</p>
          </div>
          <Button
            variant={mine ? "outline" : "default"}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = mine ? await stopTimer({ taskId }) : await startTimer({ taskId });
                if (handleResult(res)) router.refresh();
              })
            }
          >
            {mine ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} {mine ? "Pausar" : "Iniciar trabalho"}
          </Button>
        </div>
        {running && !mine && <p className="text-xs text-muted-foreground">Seu cronômetro está em “{running.title}”. Iniciar aqui pausa o outro.</p>}
        {byPerson.size > 0 && (
          <ul className="grid gap-1 text-sm">
            {[...byPerson].map(([p, ms]) => (
              <li key={p} className="flex justify-between"><span>{p}</span><span className="tabular text-muted-foreground">{formatDuration(ms)}</span></li>
            ))}
          </ul>
        )}
        {history.length > 0 && (
          <div className="grid gap-1 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Tempo em cada etapa</p>
            <ol className="grid gap-1 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between gap-2" title={`Entrou ${formatDateTime(h.entered_at)}`}>
                  <span className="truncate">{h.step_name}{h.assignee ? ` · ${h.assignee}` : ""}</span>
                  <span className="shrink-0 tabular text-muted-foreground">{h.left_at ? formatDuration(new Date(h.left_at).getTime() - new Date(h.entered_at).getTime()) : "agora"}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Section>
  );
}
