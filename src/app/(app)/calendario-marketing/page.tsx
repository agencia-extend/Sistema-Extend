import type { Metadata } from "next";
import Link from "next/link";
import { CalendarHeart, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { todayKey } from "@/domain/media";
import { MARKETING_KIND_LABEL, addMonths, dayParts, groupByMonth, lastDayOfMonth, monthTitle, requestState, shortDate } from "@/domain/marketing";
import { listCalendar, listCalendarClients, listFilterClients, type CalendarEntry } from "@/features/marketing/queries";
import { CalendarFilter } from "@/features/marketing/components/calendar-filter";
import { DateDialog } from "@/features/marketing/components/date-dialog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendário de marketing" };

const MONTHS_SHOWN = 3;

function RequestCell({ e, today }: { e: Extract<CalendarEntry, { source: "cliente" }>; today: string }) {
  const s = requestState({ onDate: e.onDate, leadDays: e.leadDays, hasBrief: Boolean(e.brief), requestTaskId: e.requestTaskId, requestedAt: e.requestedAt, requestError: e.requestError }, today);
  switch (s.kind) {
    case "scheduled":
      return <span className="text-muted-foreground">Pedido de criativo sai em {shortDate(s.on)}</span>;
    case "created":
      return <Link href={`/criativos/${s.taskId}`} className="font-medium text-primary hover:underline">Criativo pedido</Link>;
    case "error":
      return <span className="text-danger">Pedido não saiu: {s.message}</span>;
    case "missed":
      return <span className="text-muted-foreground">Data passou sem pedido</span>;
    default:
      return null;
  }
}

/** Calendário de marketing (RF-PLA-04/05): datas nacionais + datas dos clientes, por mês. */
export default async function MarketingCalendarPage({ searchParams }: { searchParams: Promise<{ de?: string; cliente?: string }> }) {
  const user = await requirePermission("marketing_calendar.read");
  const sp = await searchParams;
  const today = todayKey(new Date());
  const from = /^\d{4}-\d{2}$/.test(sp.de ?? "") ? `${sp.de}-01` : `${today.slice(0, 7)}-01`;
  const to = lastDayOfMonth(addMonths(from, MONTHS_SHOWN - 1));
  const canManage = Boolean(user.permissions["marketing_calendar.manage"]);
  const [filterClients, manageClients] = await Promise.all([listFilterClients(), canManage ? listCalendarClients() : Promise.resolve([])]);
  const clientId = filterClients.some((c) => c.id === sp.cliente) ? sp.cliente : undefined;
  const entries = await listCalendar(from, to, clientId);
  const months = groupByMonth(entries);
  const nav = (n: number) => `/calendario-marketing?${new URLSearchParams({ de: addMonths(from, n).slice(0, 7), ...(clientId ? { cliente: clientId } : {}) })}`;
  const canAdd = manageClients.length > 0;

  return (
    <>
      <PageHeader
        title="Calendário de marketing"
        description="Datas comemorativas e as datas de cada cliente. Uma data do cliente pode pedir o criativo sozinha, com antecedência."
        actions={canAdd ? <DateDialog clients={manageClients} today={today} trigger={<Button><Plus aria-hidden="true" /> Nova data</Button>} /> : undefined}
      />
      <PageBody className="grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <CalendarFilter clients={filterClients} value={clientId ?? ""} month={from} />
          <nav aria-label="Período" className="flex items-center gap-1">
            <Button asChild variant="outline" size="icon" className="size-10"><Link href={nav(-MONTHS_SHOWN)} aria-label="Meses anteriores"><ChevronLeft aria-hidden="true" /></Link></Button>
            <span className="min-w-44 px-2 text-center text-sm font-medium tabular">{shortDate(from)} a {shortDate(to)}</span>
            <Button asChild variant="outline" size="icon" className="size-10"><Link href={nav(MONTHS_SHOWN)} aria-label="Próximos meses"><ChevronRight aria-hidden="true" /></Link></Button>
          </nav>
        </div>

        {months.length === 0 ? (
          <EmptyState
            icon={CalendarHeart}
            title="Nenhuma data neste período"
            description={canAdd ? "Cadastre lançamentos, promoções e eventos do cliente para a equipe se programar." : "Quando a equipe cadastrar datas deste cliente, elas aparecem aqui."}
          />
        ) : (
          months.map((m) => (
            <section key={m.month} aria-labelledby={`m-${m.month}`} className="grid gap-2">
              <h2 id={`m-${m.month}`} className="font-heading text-lg font-semibold">{monthTitle(m.month)}</h2>
              <ul className="divide-y rounded-xl border bg-card">
                {m.items.map((e) => {
                  const d = dayParts(e.onDate);
                  const past = e.onDate < today;
                  const client = e.source === "cliente" ? manageClients.find((c) => c.id === e.client.id) : undefined;
                  return (
                    <li key={e.key} className={cn("grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:px-4", past && "opacity-60")}>
                      <div className={cn("grid h-14 place-items-center content-center rounded-lg border-l-4 bg-surface leading-none", e.source === "nacional" ? "border-gold" : "border-brand")}>
                        <span className="font-heading text-xl font-semibold tabular">{d.day}</span>
                        <span className="text-xs text-muted-foreground">{d.weekday}</span>
                      </div>
                      <div className="grid min-w-0 gap-0.5">
                        <span className="text-sm font-medium break-words">{e.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {e.source === "nacional" ? "Data nacional" : `${e.client.name}, ${MARKETING_KIND_LABEL[e.kind].toLowerCase()}`}
                        </span>
                        {e.source === "cliente" && (
                          <span className="text-xs"><RequestCell e={e} today={today} /></span>
                        )}
                      </div>
                      <div className="col-start-2 flex flex-wrap gap-2 sm:col-start-3">
                        {e.source === "nacional" && canAdd && !past && (
                          <DateDialog clients={manageClients} today={today} prefill={{ title: e.title, onDate: e.onDate }}
                            trigger={<Button variant="outline" size="sm" aria-label={`Usar ${e.title} para um cliente`}>Usar para um cliente</Button>} />
                        )}
                        {e.source === "cliente" && client && (
                          <DateDialog clients={manageClients} today={today}
                            date={{ id: e.id, clientId: e.client.id, title: e.title, onDate: e.onDate, kind: e.kind, notes: e.notes, leadDays: e.leadDays, brief: e.brief, requestTaskId: e.requestTaskId }}
                            trigger={<Button variant="ghost" size="sm" aria-label={`Alterar ${e.title}`}>Alterar</Button>} />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </PageBody>
    </>
  );
}
