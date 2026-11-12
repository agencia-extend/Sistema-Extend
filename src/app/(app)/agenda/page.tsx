import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listSectors } from "@/features/admin/queries";
import { listTeam } from "@/features/clients/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import { calendarRange, shiftDay, spDayKey, type CalendarView } from "@/domain/calendar";
import { EventDialog } from "@/features/tasks/components/event-dialog";
import { AgendaGrid, type AgendaItem } from "./agenda-grid";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Agenda" };

const VIEWS: Record<CalendarView, string> = { dia: "Dia", semana: "Semana", mes: "Mês" };
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

/** Agenda (RF-AGE-01/02): minha agenda ou de um setor; eventos, gravações, prazos, tempo trabalhado e reuniões. */
export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ visao?: string; data?: string; setor?: string }> }) {
  const user = await requirePermission("calendar.read");
  const sp = await searchParams;
  const view = (sp.visao && sp.visao in VIEWS ? sp.visao : "semana") as CalendarView;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? "") ? sp.data! : spDayKey(new Date());
  const { days, start, end } = calendarRange(view, day);
  const scope = user.permissions["calendar.read"];
  const allSectors = (await listSectors()).filter((s) => s.is_active);
  const sectors = scope === "all" ? allSectors : allSectors.filter((s) => user.sectors.some((x) => x.id === s.id));
  const sector = sectors.find((s) => s.key === sp.setor) ?? null;

  const supabase = await createClient();
  const s = start.toISOString();
  const e = end.toISOString();
  let evq = supabase.from("calendar_events").select("id, title, kind, starts_at, ends_at, location, link, notes, sector_id, client_id, task_id, created_by, calendar_attendees(profile_id), clients(name)").lt("starts_at", e).gt("ends_at", s);
  if (sector) evq = evq.eq("sector_id", sector.id);
  const [events, tasks, time, meetings, team, clients] = await Promise.all([
    evq.order("starts_at"),
    sector ? Promise.resolve({ data: [] }) : supabase.from("tasks").select("id, title, due_at, status, clients(name)").eq("assignee_id", user.id).is("deleted_at", null).gte("due_at", s).lt("due_at", e),
    sector ? Promise.resolve({ data: [] }) : supabase.from("task_time_entries").select("id, started_at, ended_at, task_id, tasks(title)").eq("profile_id", user.id).gte("started_at", s).lt("started_at", e),
    sector ? Promise.resolve({ data: [] }) : supabase.from("client_meetings").select("id, title, held_at, client_id, clients(name)").contains("participant_ids", [user.id]).gte("held_at", s).lt("held_at", e),
    listTeam(),
    supabase.from("clients").select("id, name").is("deleted_at", null).in("status", ["ativo", "onboarding"]).order("name"),
  ]);

  const mineOnly = (ev: { created_by: string | null; calendar_attendees: { profile_id: string }[] }) =>
    sector || ev.created_by === user.id || ev.calendar_attendees.some((a) => a.profile_id === user.id);
  const items: AgendaItem[] = [
    ...(events.data ?? []).filter(mineOnly).map((ev) => ({
      id: `e-${ev.id}`,
      kind: ev.kind as AgendaItem["kind"],
      title: ev.title,
      start: ev.starts_at,
      end: ev.ends_at,
      sub: [one(ev.clients)?.name, ev.location].filter(Boolean).join(" · "),
      href: ev.task_id ? `/tarefas/${ev.task_id}` : null,
      event: {
        id: ev.id, title: ev.title, kind: ev.kind, sectorId: ev.sector_id, clientId: ev.client_id, taskId: ev.task_id, startsAt: ev.starts_at, endsAt: ev.ends_at,
        location: ev.location ?? "", link: ev.link ?? "", notes: ev.notes ?? "", attendeeIds: ev.calendar_attendees.map((a) => a.profile_id),
      },
      editable: ev.created_by === user.id || scope === "all",
    })),
    ...((tasks.data ?? []) as { id: string; title: string; due_at: string; status: string; clients: unknown }[]).map((t) => ({
      id: `t-${t.id}`, kind: "prazo" as const, title: t.title, start: t.due_at, end: null, sub: one(t.clients as { name: string } | null)?.name ?? "", href: `/tarefas/${t.id}`, done: ["concluido", "aprovado"].includes(t.status),
    })),
    ...((time.data ?? []) as { id: string; started_at: string; ended_at: string | null; task_id: string; tasks: unknown }[]).map((t) => ({
      id: `w-${t.id}`, kind: "trabalho" as const, title: one(t.tasks as { title: string } | null)?.title ?? "Trabalho", start: t.started_at, end: t.ended_at, sub: "tempo trabalhado", href: `/tarefas/${t.task_id}`,
    })),
    ...((meetings.data ?? []) as { id: string; title: string; held_at: string; client_id: string; clients: unknown }[]).map((m) => ({
      id: `m-${m.id}`, kind: "reuniao" as const, title: m.title, start: m.held_at, end: null, sub: one(m.clients as { name: string } | null)?.name ?? "", href: `/clientes/${m.client_id}/reunioes`,
    })),
  ];

  const [y, mo] = day.split("-").map(Number);
  const title = view === "mes" ? `${MONTHS[mo - 1]} de ${y}` : view === "semana" ? `Semana de ${days[0].slice(8)}/${days[0].slice(5, 7)}` : `${day.slice(8)}/${day.slice(5, 7)}/${y}`;
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ visao: view, data: day, ...(sector ? { setor: sector.key } : {}), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `?${p}`;
  };
  const teamOpts = team.map((t) => ({ id: t.id, name: t.name }));

  return (
    <>
      <PageHeader
        title="Agenda"
        description={sector ? `Agenda do setor ${sector.name}.` : "Seus eventos, gravações, prazos e o tempo trabalhado."}
        actions={user.permissions["calendar.manage"] ? (
          <EventDialog team={teamOpts} sectors={sectors.map((x) => ({ id: x.id, name: x.name }))} clients={clients.data ?? []} preset={{ title: "", kind: "evento", sectorId: sector?.id ?? null, attendeeIds: [user.id] }} />
        ) : undefined}
      />
      <PageBody className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={qs({ data: shiftDay(view, day, -1) })} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Anterior"><ChevronLeft /></Link>
          <Link href={qs({ data: spDayKey(new Date()) })} className={buttonVariants({ variant: "outline" })}>Hoje</Link>
          <Link href={qs({ data: shiftDay(view, day, 1) })} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Próximo"><ChevronRight /></Link>
          <h2 className="mr-auto text-base font-semibold first-letter:uppercase">{title}</h2>
          <nav aria-label="Visão" className="flex rounded-lg border p-0.5">
            {Object.entries(VIEWS).map(([k, l]) => (
              <Link key={k} href={qs({ visao: k })} aria-current={view === k ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-sm", view === k ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</Link>
            ))}
          </nav>
        </div>
        {sectors.length > 0 && (
          <nav aria-label="Agenda" className="flex flex-wrap gap-1.5">
            <Link href={qs({ setor: "" })} aria-current={!sector ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", !sector ? "border-brand bg-accent font-medium" : "hover:bg-muted")}>Minha agenda</Link>
            {sectors.map((x) => (
              <Link key={x.id} href={qs({ setor: x.key })} aria-current={sector?.id === x.id ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", sector?.id === x.id ? "border-brand bg-accent font-medium" : "hover:bg-muted")}>{x.name}</Link>
            ))}
          </nav>
        )}
        <AgendaGrid view={view} days={days} today={spDayKey(new Date())} month={day.slice(0, 7)} items={items} team={teamOpts} sectors={sectors.map((x) => ({ id: x.id, name: x.name }))} clients={clients.data ?? []} />
      </PageBody>
    </>
  );
}
