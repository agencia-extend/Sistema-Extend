"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, Hourglass } from "lucide-react";
import { moveTask } from "@/features/tasks/actions";
import { handleResult } from "@/lib/action-feedback";
import { cn } from "@/lib/utils";

type Opt = { id: string; name: string; color: string; kind: "step" | "column"; waitsClient?: boolean };

/** Trilho de etapas: clicar move o card (e troca o responsável pelo fluxo). */
export function StagePicker({ taskId, options, current, canMove }: { taskId: string; options: Opt[]; current: string | null; canMove: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const idx = options.findIndex((o) => o.id === current);
  if (!options.length) return null;
  return (
    <section aria-label="Etapa" className="grid gap-2">
      <h2 className="text-sm font-semibold">Etapa {idx >= 0 && <span className="font-normal text-muted-foreground">({idx + 1} de {options.length})</span>}</h2>
      <ol className="flex flex-wrap gap-1.5">
        {options.map((o, i) => {
          const isCur = o.id === current;
          const done = idx >= 0 && i < idx;
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={!canMove || pending || isCur}
                aria-current={isCur ? "step" : undefined}
                onClick={() =>
                  startTransition(async () => {
                    const res = await moveTask({ id: taskId, stepId: o.kind === "step" ? o.id : null, columnId: o.kind === "column" ? o.id : null, position: null });
                    if (handleResult({ ...res, message: res.ok ? `Movido para ${o.name}.` : res.message } as typeof res)) router.refresh();
                  })
                }
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors disabled:cursor-default",
                  isCur ? "border-transparent font-semibold text-white" : done ? "bg-muted text-muted-foreground" : "bg-card hover:border-brand/60",
                )}
                style={isCur ? { background: o.color } : undefined}
              >
                {done && <Check className="size-3.5" aria-hidden="true" />}
                {o.waitsClient && !isCur && <Hourglass className="size-3.5 text-warning" aria-hidden="true" />}
                {o.name}
              </button>
            </li>
          );
        })}
      </ol>
      {options[idx]?.waitsClient && <p className="text-sm text-warning">Esta etapa aguarda o retorno do cliente.</p>}
    </section>
  );
}
