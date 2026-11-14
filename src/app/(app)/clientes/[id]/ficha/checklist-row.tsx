"use client";

import { useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateChecklistItem } from "@/features/clients/actions";
import { handleResult } from "@/lib/action-feedback";
import { formatDate } from "@/domain/shared/dates";
import { cn } from "@/lib/utils";

export type ChecklistItem = {
  id: string;
  title: string;
  guidance: string | null;
  milestone: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  doneAt: string | null;
};

const NONE = "__ninguem";
/** Data (aaaa-mm-dd) em São Paulo para o campo de data. */
const spDay = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10) : "");

/** Um passo: marcar feito, orientação do Miro, responsável e prazo (quem gerencia edita). */
export function ChecklistRow({ item: i, team, canManage, editable }: { item: ChecklistItem; team: { id: string; name: string }[]; canManage: boolean; editable: boolean }) {
  const [pending, startTransition] = useTransition();
  const run = (p: Promise<{ ok: boolean; message?: string } & object>) => startTransition(async () => void handleResult((await p) as never));
  const late = !i.doneAt && i.dueAt && i.dueAt < new Date().toISOString();

  return (
    <li className={cn("grid gap-2 rounded-xl border bg-card p-3", late && "border-danger/40")}>
      <div className="flex items-start gap-3">
        <Checkbox
          id={`ck-${i.id}`}
          className="mt-0.5"
          checked={Boolean(i.doneAt)}
          disabled={!editable || pending}
          onCheckedChange={(v) => run(updateChecklistItem({ id: i.id, done: v === true }))}
        />
        <div className="grid min-w-0 gap-1">
          <label htmlFor={`ck-${i.id}`} className={cn("text-sm", i.doneAt && "text-muted-foreground line-through")}>{i.title}</label>
          {i.guidance && !i.doneAt && <p className="text-xs leading-5 break-words text-muted-foreground">{i.guidance}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-7">
        {canManage ? (
          <>
            <Select value={i.assigneeId ?? NONE} onValueChange={(v) => run(updateChecklistItem({ id: i.id, assigneeId: v === NONE ? null : v }))}>
              <SelectTrigger size="sm" className="h-8 w-44" aria-label={`Responsável por ${i.title}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem responsável</SelectItem>
                {team.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="h-8 w-40"
              aria-label={`Prazo de ${i.title}`}
              defaultValue={spDay(i.dueAt)}
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== spDay(i.dueAt)) run(updateChecklistItem({ id: i.id, dueAt: v ? `${v}T23:59:00-03:00` : null }));
              }}
            />
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{i.assigneeName ?? "Sem responsável"}</span>
        )}
        {i.dueAt && <span className={cn("text-xs tabular", late ? "font-medium text-danger" : "text-muted-foreground")}>{late ? "Atrasado · " : ""}{formatDate(i.dueAt)}</span>}
      </div>
    </li>
  );
}
