import "server-only";
import { createClient } from "@/lib/supabase/server";
import { periodStart, type OpsPeriod, type OpsTask } from "@/domain/ops";
import { todayKey } from "@/domain/media";

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export type Meeting = { id: string; title: string; startsAt: string; clientId: string | null; clientName: string | null; href: string };
export type ClientHealth = { id: string; name: string; delivered: number; contracted: number; late: number };

/** Dados do painel operacional. A RLS decide o que cada pessoa enxerga. */
export async function opsData(period: OpsPeriod) {
  const supabase = await createClient();
  const now = new Date();
  const since = periodStart(period, now) ?? new Date(now.getTime() - 365 * 86_400_000).toISOString();
  const week = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const today = todayKey(now);
  const sel = "id, title, type, status, priority, due_at, completed_at, assignee_id, client_id, clients(name), profiles!tasks_assignee_id_fkey(full_name)";

  const [open, done, events, meetings, months] = await Promise.all([
    supabase.from("tasks").select(sel).is("deleted_at", null).not("status", "in", "(concluido,cancelado)").limit(3000),
    supabase.from("tasks").select(sel).is("deleted_at", null).eq("status", "concluido").gte("completed_at", since).limit(3000),
    supabase.from("calendar_events").select("id, title, starts_at, client_id, clients(name)").eq("kind", "reuniao").gte("starts_at", now.toISOString()).lte("starts_at", week).order("starts_at").limit(8),
    supabase.from("client_meetings").select("id, title, held_at, client_id, clients(name)").gte("held_at", now.toISOString()).lte("held_at", week).order("held_at").limit(8),
    supabase.from("client_months").select("client_id, starts_on").lte("starts_on", today).gte("ends_on", today),
  ]);
  for (const r of [open, done, events, meetings, months]) if (r.error) throw r.error;

  const map = (rows: unknown[]): OpsTask[] =>
    (rows as Record<string, unknown>[]).map((t) => ({
      id: t.id as string,
      title: t.title as string,
      type: t.type as string,
      status: t.status as string,
      priority: t.priority as string,
      dueAt: (t.due_at as string) ?? null,
      completedAt: (t.completed_at as string) ?? null,
      assigneeId: (t.assignee_id as string) ?? null,
      assigneeName: one(t.profiles as { full_name: string } | null)?.full_name ?? null,
      clientId: (t.client_id as string) ?? null,
      clientName: one(t.clients as { name: string } | null)?.name ?? null,
    }));

  const upcoming: Meeting[] = [
    ...(events.data ?? []).map((e) => ({ id: e.id, title: e.title, startsAt: e.starts_at, clientId: e.client_id, clientName: one(e.clients)?.name ?? null, href: `/agenda?visao=dia&data=${new Date(new Date(e.starts_at).getTime() - 3 * 3600_000).toISOString().slice(0, 10)}` })),
    ...(meetings.data ?? []).map((m) => ({ id: m.id, title: m.title, startsAt: m.held_at, clientId: m.client_id, clientName: one(m.clients)?.name ?? null, href: `/clientes/${m.client_id}/reunioes` })),
  ]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 6);

  // Saúde dos clientes: entregue × contratado no mês atual de cada cliente.
  const starts = [...new Set((months.data ?? []).map((m) => m.starts_on))];
  const monthOf = new Map((months.data ?? []).map((m) => [m.client_id, m.starts_on]));
  const slots = starts.length
    ? await supabase.from("tasks").select("client_id, slot_month, status, due_at, clients(name)").is("deleted_at", null).in("slot_month", starts).limit(10000)
    : { data: [], error: null };
  if (slots.error) throw slots.error;
  const health = new Map<string, ClientHealth>();
  const nowIso = now.toISOString();
  for (const s of slots.data ?? []) {
    if (!s.client_id || s.status === "cancelado" || monthOf.get(s.client_id) !== s.slot_month) continue;
    const h = health.get(s.client_id) ?? { id: s.client_id, name: one(s.clients)?.name ?? "", delivered: 0, contracted: 0, late: 0 };
    h.contracted++;
    if (s.status === "concluido" || s.status === "aprovado") h.delivered++;
    else if (s.due_at && s.due_at < nowIso) h.late++;
    health.set(s.client_id, h);
  }

  return {
    tasks: [...map(open.data ?? []), ...map(done.data ?? [])],
    meetings: upcoming,
    health: [...health.values()].sort((a, b) => a.delivered / a.contracted - b.delivered / b.contracted || b.late - a.late).slice(0, 12),
  };
}
