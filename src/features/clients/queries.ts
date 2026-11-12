import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ClientStatus } from "@/domain/clients";
import type { FormSection } from "./schemas";

function arr<T>(v: T | T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

export type CatalogService = {
  id: string;
  key: string;
  name: string;
  unit: string;
  task_type: string | null;
  tabs: string[];
  sector_id: string | null;
  is_active: boolean;
  position: number;
};

export const listCatalog = cache(async (): Promise<CatalogService[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_catalog")
    .select("id, key, name, unit, task_type, tabs, sector_id, is_active, position")
    .order("position");
  if (error) throw error;
  return data;
});

export type ClientCard = {
  id: string;
  name: string;
  segment: string | null;
  status: ClientStatus;
  contract_end: string | null;
  services: { name: string; qty: number; tabs: string[] }[];
  members: { id: string; name: string; sector: string }[];
  monthTotal: number;
  monthDone: number;
  overdue: number;
  onboardingDone: number;
  onboardingTotal: number;
  created_at: string;
};

const DONE = new Set(["concluido", "aprovado"]);

export async function listClients(): Promise<ClientCard[]> {
  const supabase = await createClient();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().slice(0, 10);
  const [clients, tasks, checklist] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, segment, status, contract_end, created_at, client_services(monthly_qty, starts_on, ends_on, service_catalog(name, tabs)), client_members(profile_id, profiles(full_name, email), sectors(name))",
      )
      .is("deleted_at", null)
      .order("name"),
    supabase.from("tasks").select("client_id, status, due_at, slot_month").not("client_id", "is", null),
    supabase.from("onboarding_checklist_items").select("client_id, done_at"),
  ]);
  if (clients.error) throw clients.error;

  const taskAgg = new Map<string, { total: number; done: number; overdue: number }>();
  for (const t of tasks.data ?? []) {
    if (!t.client_id || t.status === "cancelado") continue;
    const a = taskAgg.get(t.client_id) ?? { total: 0, done: 0, overdue: 0 };
    if (t.slot_month === month || (t.due_at && t.due_at.slice(0, 7) === month.slice(0, 7))) {
      a.total++;
      if (DONE.has(t.status)) a.done++;
    }
    if (!DONE.has(t.status) && t.due_at && t.due_at < now.toISOString()) a.overdue++;
    taskAgg.set(t.client_id, a);
  }
  const obAgg = new Map<string, { done: number; total: number }>();
  for (const c of checklist.data ?? []) {
    const a = obAgg.get(c.client_id) ?? { done: 0, total: 0 };
    a.total++;
    if (c.done_at) a.done++;
    obAgg.set(c.client_id, a);
  }

  return clients.data.map((c) => {
    const t = taskAgg.get(c.id) ?? { total: 0, done: 0, overdue: 0 };
    const ob = obAgg.get(c.id) ?? { done: 0, total: 0 };
    return {
      id: c.id,
      name: c.name,
      segment: c.segment,
      status: c.status as ClientStatus,
      contract_end: c.contract_end,
      created_at: c.created_at,
      services: arr(c.client_services)
        .filter((s) => s.starts_on <= today && (!s.ends_on || s.ends_on >= today))
        .flatMap((s) => arr(s.service_catalog).map((sc) => ({ name: sc.name, qty: s.monthly_qty, tabs: sc.tabs }))),
      members: arr(c.client_members).map((m) => {
        const p = arr(m.profiles)[0];
        return { id: m.profile_id, name: p?.full_name || p?.email || "", sector: arr(m.sectors)[0]?.name ?? "" };
      }),
      monthTotal: t.total,
      monthDone: t.done,
      overdue: t.overdue,
      onboardingDone: ob.done,
      onboardingTotal: ob.total,
    };
  });
}

export const getClient = cache(async (id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "*, client_services(id, monthly_qty, price_cents, starts_on, ends_on, service_id, service_catalog(id, name, unit, tabs, task_type, sector_id)), client_members(sector_id, profile_id, is_default, profiles(full_name, email, is_active), sectors(name, color)), client_accounts(id, kind, value, label), client_contacts(id, name, role, phone, email, is_primary), handoff_promises(id, description, due_at, done_at)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
});

export type ClientDetail = NonNullable<Awaited<ReturnType<typeof getClient>>>;

/** Serviços vigentes hoje (o que define abas e demandas). */
export function currentServices(client: ClientDetail) {
  const today = new Date().toISOString().slice(0, 10);
  return arr(client.client_services).filter((s) => s.starts_on <= today && (!s.ends_on || s.ends_on >= today));
}

/** Mudanças agendadas para o próximo mês. */
export function upcomingServices(client: ClientDetail) {
  const today = new Date().toISOString().slice(0, 10);
  return arr(client.client_services).filter((s) => s.starts_on > today);
}

export async function getHandoff(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("commercial_handoffs")
    .select("id, closed_on, monthly_fee_cents, setup_fee_cents, payment_method, contract_months, notes, sold_by, profiles!commercial_handoffs_sold_by_fkey(full_name)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getOnboarding(clientId: string) {
  const supabase = await createClient();
  const [ob, checklist] = await Promise.all([
    supabase.from("client_onboarding").select("answers, completed_at, updated_at, onboarding_forms(sections, version)").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("onboarding_checklist_items")
      .select("id, title, assignee_id, due_at, done_at, position, profiles!onboarding_checklist_items_assignee_id_fkey(full_name)")
      .eq("client_id", clientId)
      .order("position"),
  ]);
  const form = arr(ob.data?.onboarding_forms)[0];
  return {
    canReadFull: Boolean(ob.data),
    answers: (ob.data?.answers ?? {}) as Record<string, unknown>,
    completedAt: ob.data?.completed_at ?? null,
    updatedAt: ob.data?.updated_at ?? null,
    sections: (form?.sections ?? []) as unknown as FormSection[],
    version: form?.version ?? null,
    checklist: (checklist.data ?? []).map((c) => ({ ...c, assignee_name: arr(c.profiles)[0]?.full_name ?? null })),
  };
}

export async function getOperationalSummary(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_operational_summary", { p_client: clientId });
  if (error) throw error;
  return data ?? [];
}

export async function getMissing(clientId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("onboarding_missing", { p_client: clientId });
  if (error) throw error;
  return data ?? [];
}

export async function listTeam() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, profile_sectors(sector_id)")
    .eq("is_active", true)
    .order("full_name");
  if (error) throw error;
  return data.map((p) => ({ id: p.id, name: p.full_name || p.email, sectorIds: arr(p.profile_sectors).map((s) => s.sector_id) }));
}

export async function listMeetings(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_meetings")
    .select("id, held_at, kind, title, summary, link, participant_ids, created_by, client_files(id, name, storage_path, mime_type, size_bytes)")
    .eq("client_id", clientId)
    .order("held_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listIdeas(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_ideas")
    .select("id, title, body, link, tags, converted_task_id, created_by, created_at, profiles!client_ideas_created_by_fkey(full_name)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((i) => ({ ...i, author: arr(i.profiles)[0]?.full_name ?? "" }));
}

export async function listFiles(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_files")
    .select("id, name, storage_path, mime_type, size_bytes, category, created_at, uploaded_by, profiles!client_files_uploaded_by_fkey(full_name)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((f) => ({ ...f, author: arr(f.profiles)[0]?.full_name ?? "" }));
}

export async function listTimeline(clientId: string, kind?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("client_timeline")
    .select("id, kind, title, created_at, profiles!client_timeline_actor_id_fkey(full_name)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((t) => ({ ...t, actor: arr(t.profiles)[0]?.full_name ?? null }));
}

export async function listMonthTasks(clientId: string, month: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, type, status, due_at, slot_index, slot_total, service_id, assignee_id, workflow_step_id, profiles!tasks_assignee_id_fkey(full_name), service_catalog(name), workflow_steps(name, color)")
    .eq("client_id", clientId)
    .eq("slot_month", month)
    .order("service_id")
    .order("slot_index");
  if (error) throw error;
  return data.map((t) => ({ ...t, assignee: arr(t.profiles)[0]?.full_name ?? null, service: arr(t.service_catalog)[0]?.name ?? "Avulsa", step: arr(t.workflow_steps)[0] ?? null }));
}
