import Link from "next/link";
import { CalendarClock, Clock } from "lucide-react";
import { SOURCE_LABEL, slaState } from "@/domain/crm";
import { formatBRL } from "@/domain/shared/money";
import { formatDateTime } from "@/domain/shared/dates";
import type { LeadRow } from "@/features/crm/queries";
import { cn } from "@/lib/utils";

/** Card do lead no funil: quem é, quanto vale, há quanto tempo está parado e a próxima ação. */
export function LeadCard({ lead, slaDays, open, now }: { lead: LeadRow; slaDays: number | null; open: boolean; now: number }) {
  const sla = slaState(lead.stageChangedAt, slaDays, new Date(now));
  const overdue = lead.nextAction && new Date(lead.nextAction.dueAt).getTime() < now;
  return (
    <div className={cn("grid gap-1.5 rounded-lg border bg-card p-3 text-sm shadow-xs", open && sla.late && "border-warning")}>
      <Link href={`/comercial/leads/${lead.id}`} className="font-medium break-words hover:underline focus-visible:underline">
        {lead.name}
      </Link>
      {lead.company && <span className="-mt-1 text-xs text-muted-foreground break-words">{lead.company}</span>}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{SOURCE_LABEL[lead.source]}</span>
        {lead.valueCents != null && <span className="tabular text-foreground">{formatBRL(lead.valueCents)}</span>}
        {lead.ownerName && <span className="truncate">{lead.ownerName}</span>}
      </span>
      {open && (
        <span className={cn("flex items-center gap-1 text-xs tabular", sla.late ? "font-medium text-warning" : "text-muted-foreground")}>
          <Clock className="size-3.5" aria-hidden="true" />
          {sla.days === 0 ? "Entrou hoje" : `${sla.days} dia${sla.days === 1 ? "" : "s"} na etapa`}
          {sla.late && " · passou do prazo"}
        </span>
      )}
      {lead.nextAction && (
        <span className={cn("flex items-start gap-1 text-xs", overdue ? "font-medium text-danger" : "text-muted-foreground")}>
          <CalendarClock className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{formatDateTime(lead.nextAction.dueAt)}: {lead.nextAction.body}</span>
        </span>
      )}
    </div>
  );
}
