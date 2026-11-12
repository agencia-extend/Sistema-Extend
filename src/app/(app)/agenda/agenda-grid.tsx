import Link from "next/link";
import { spDayKey, type CalendarView } from "@/domain/calendar";
import { EventDialog, EVENT_KIND } from "@/features/tasks/components/event-dialog";
import { cn } from "@/lib/utils";

export type AgendaItem = {
  id: string;
  kind: "gravacao" | "reuniao" | "evento" | "bloqueio" | "prazo" | "trabalho";
  title: string;
  start: string;
  end: string | null;
  sub: string;
  href: string | null;
  done?: boolean;
  editable?: boolean;
  event?: Parameters<typeof EventDialog>[0]["preset"];
};

const KIND_STYLE: Record<AgendaItem["kind"], string> = {
  gravacao: "border-l-[#F97316]",
  reuniao: "border-l-[#8B5CF6]",
  evento: "border-l-brand",
  bloqueio: "border-l-neutral-status",
  prazo: "border-l-danger",
  trabalho: "border-l-success",
};
const KIND_LABEL: Record<AgendaItem["kind"], string> = { ...EVENT_KIND, prazo: "Prazo", trabalho: "Trabalhado" } as Record<AgendaItem["kind"], string>;
const WEEK = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

const hhmm = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(11, 16);

function Item({ it, team, sectors, clients, compact }: { it: AgendaItem; team: { id: string; name: string }[]; sectors: { id: string; name: string }[]; clients: { id: string; name: string }[]; compact?: boolean }) {
  const body = (
    <span className={cn("grid gap-0.5 rounded-md border border-l-4 bg-card px-2 py-1.5 text-left text-xs hover:border-brand/50", KIND_STYLE[it.kind], it.done && "opacity-60")}>
      <span className="flex gap-1.5 text-muted-foreground tabular">
        {hhmm(it.start)}
        {it.end && `–${hhmm(it.end)}`}
        <span>· {KIND_LABEL[it.kind]}</span>
      </span>
      <span className={cn("font-medium text-foreground", compact ? "line-clamp-1" : "line-clamp-2")}>{it.title}</span>
      {!compact && it.sub && <span className="truncate text-muted-foreground">{it.sub}</span>}
    </span>
  );
  if (it.event && it.editable) return <EventDialog team={team} sectors={sectors} clients={clients} preset={it.event} trigger={<button type="button" className="w-full">{body}</button>} />;
  if (it.href) return <Link href={it.href} className="block">{body}</Link>;
  return body;
}

export function AgendaGrid({
  view,
  days,
  today,
  month,
  items,
  team,
  sectors,
  clients,
}: {
  view: CalendarView;
  days: string[];
  today: string;
  month: string;
  items: AgendaItem[];
  team: { id: string; name: string }[];
  sectors: { id: string; name: string }[];
  clients: { id: string; name: string }[];
}) {
  const byDay = new Map<string, AgendaItem[]>(days.map((d) => [d, []]));
  for (const it of items) byDay.get(spDayKey(it.start))?.push(it);
  for (const list of byDay.values()) list.sort((a, b) => a.start.localeCompare(b.start));

  if (view === "mes") {
    return (
      <div className="overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border">
          {WEEK.map((w) => <div key={w} className="bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground">{w}</div>)}
          {days.map((d) => {
            const list = byDay.get(d) ?? [];
            return (
              <div key={d} className={cn("grid min-h-28 content-start gap-1 bg-card p-1.5", d.slice(0, 7) !== month && "bg-muted/40")}>
                <Link href={`?visao=dia&data=${d}`} className={cn("justify-self-start rounded px-1 text-xs tabular hover:underline", d === today && "bg-brand font-semibold text-white")}>{Number(d.slice(8))}</Link>
                {list.slice(0, 3).map((it) => <Item key={it.id} it={it} team={team} sectors={sectors} clients={clients} compact />)}
                {list.length > 3 && <Link href={`?visao=dia&data=${d}`} className="px-1 text-xs text-primary hover:underline">+{list.length - 3} mais</Link>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3", view === "semana" && "lg:grid-cols-7")}>
      {days.map((d, i) => {
        const list = byDay.get(d) ?? [];
        return (
          <section key={d} aria-label={d} className={cn("grid content-start gap-2 rounded-xl border bg-muted/30 p-2", d === today && "border-brand/60")}>
            <h3 className="flex items-baseline gap-1.5 px-1 text-sm">
              <span className="text-muted-foreground">{WEEK[(i + (view === "dia" ? (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7 : 0)) % 7]}</span>
              <span className={cn("font-semibold tabular", d === today && "text-brand")}>{d.slice(8)}/{d.slice(5, 7)}</span>
            </h3>
            {list.length === 0 ? <p className="px-1 text-xs text-muted-foreground">Livre</p> : list.map((it) => <Item key={it.id} it={it} team={team} sectors={sectors} clients={clients} />)}
          </section>
        );
      })}
    </div>
  );
}
