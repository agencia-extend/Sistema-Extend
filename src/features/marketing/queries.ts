import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MarketingKind } from "@/domain/marketing";
import type { BriefInput } from "./schemas";

export type CalendarEntry =
  | { source: "nacional"; key: string; onDate: string; title: string }
  | {
      source: "cliente";
      key: string;
      id: string;
      onDate: string;
      title: string;
      kind: MarketingKind;
      notes: string | null;
      leadDays: number;
      brief: BriefInput | null;
      requestTaskId: string | null;
      requestedAt: string | null;
      requestError: string | null;
      client: { id: string; name: string };
    };

/** Datas nacionais (calculadas no banco) + datas dos clientes que a pessoa vê (a RLS filtra). */
export async function listCalendar(start: string, end: string, clientId?: string): Promise<CalendarEntry[]> {
  const supabase = await createClient();
  let q = supabase
    .from("marketing_dates")
    .select("id, on_date, title, kind, notes, lead_days, brief, request_task_id, requested_at, request_error, clients!inner(id, name, deleted_at)")
    .gte("on_date", start)
    .lte("on_date", end)
    .is("clients.deleted_at", null)
    .order("on_date");
  if (clientId) q = q.eq("client_id", clientId);
  const [national, own] = await Promise.all([supabase.rpc("national_marketing_dates", { p_start: start, p_end: end }), q]);
  if (national.error) throw national.error;
  if (own.error) throw own.error;
  const out: CalendarEntry[] = clientId ? [] : national.data.map((n) => ({ source: "nacional" as const, key: `n:${n.on_date}:${n.title}`, onDate: n.on_date, title: n.title }));
  for (const r of own.data) {
    const c = Array.isArray(r.clients) ? r.clients[0] : r.clients;
    out.push({
      source: "cliente",
      key: r.id,
      id: r.id,
      onDate: r.on_date,
      title: r.title,
      kind: r.kind as MarketingKind,
      notes: r.notes,
      leadDays: r.lead_days,
      brief: (r.brief as BriefInput | null) ?? null,
      requestTaskId: r.request_task_id,
      requestedAt: r.requested_at,
      requestError: r.request_error,
      client: { id: c.id, name: c.name },
    });
  }
  return out.sort((a, b) => a.onDate.localeCompare(b.onDate) || (a.source === "nacional" ? -1 : 1));
}

/** Clientes em que a pessoa cadastra datas e se pode agendar pedido de criativo (o banco confere de novo ao salvar). */
export async function listCalendarClients(): Promise<{ id: string; name: string; canRequest: boolean }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("marketing_calendar_clients");
  if (error) throw error;
  return data.map((c) => ({ id: c.id, name: c.name, canRequest: c.can_request }));
}

/** Clientes que a pessoa vê, para o filtro. */
export async function listFilterClients(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, name").is("deleted_at", null).in("status", ["ativo", "onboarding", "pausado"]).order("name");
  if (error) throw error;
  return data;
}
