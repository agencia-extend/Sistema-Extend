import Link from "next/link";
import { CalendarClock, Hourglass, Link2, Repeat } from "lucide-react";
import { repeatLabel } from "@/domain/tasks/repeat";
import { dueState, TASK_TYPE_LABEL } from "@/domain/tasks";
import { formatDate, formatDateTime } from "@/domain/shared/dates";
import type { TaskRow } from "@/features/tasks/queries";
import { cn } from "@/lib/utils";

export function DueBadge({ dueAt, status, className }: { dueAt: string | null; status: string; className?: string }) {
  if (!dueAt) return null;
  const s = dueState(dueAt, status);
  const cls = { late: "text-danger font-medium", today: "text-warning font-medium", soon: "text-foreground", later: "text-muted-foreground", done: "text-muted-foreground", none: "" }[s];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs whitespace-nowrap tabular", cls, className)} title={formatDateTime(dueAt)}>
      <CalendarClock className="size-3.5" aria-hidden="true" />
      {s === "late" ? "Atrasada · " : s === "today" ? "Hoje · " : ""}
      {formatDate(dueAt)}
    </span>
  );
}

export function TagChips({ tags }: { tags: { id: string; name: string; color: string }[] }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Etiquetas">
      {tags.map((t) => (
        <li key={t.id} className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px]">
          <span className="size-2 rounded-full" style={{ background: t.color }} aria-hidden="true" />
          {t.name}
        </li>
      ))}
    </ul>
  );
}

/** Card do Kanban/lista. Borda vermelha quando atrasado (RF-TAR-09). */
export function TaskCardView({ t, showClient = true, showStep = false }: { t: TaskRow; showClient?: boolean; showStep?: boolean }) {
  const late = dueState(t.dueAt, t.status) === "late";
  return (
    <Link
      href={`/tarefas/${t.id}`}
      className={cn(
        "grid grid-cols-[minmax(0,1fr)] gap-1.5 rounded-lg border bg-card p-3 text-left shadow-xs transition-colors hover:border-brand/60",
        late && "border-danger/60 bg-danger-soft/40",
        t.waitsClient && !late && "border-warning/60",
      )}
    >
      <TagChips tags={t.tags} />
      <span className="line-clamp-3 text-sm leading-snug font-medium wrap-break-word">{t.title}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {showClient && t.clientName && <span className="max-w-full truncate">{t.clientName}</span>}
        <span>{TASK_TYPE_LABEL[t.type] ?? t.type}</span>
        {showStep && t.stepName && (
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: t.stepColor ?? "#64748B" }} aria-hidden="true" />
            {t.stepName}
          </span>
        )}
        {t.waitsClient && (
          <span className="inline-flex items-center gap-1 text-warning">
            <Hourglass className="size-3" aria-hidden="true" /> aguarda cliente
          </span>
        )}
        {t.repeatUnit && (
          <span className="inline-flex items-center gap-1">
            <Repeat className="size-3" aria-hidden="true" /> {repeatLabel(t.repeatUnit, t.repeatEvery)?.toLowerCase()}
          </span>
        )}
        {t.blocked && (
          <span className="inline-flex items-center gap-1">
            <Link2 className="size-3" aria-hidden="true" /> aguardando outra demanda
          </span>
        )}
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{t.assigneeName ?? "Sem responsável"}</span>
        <DueBadge dueAt={t.dueAt} status={t.status} />
      </span>
    </Link>
  );
}
