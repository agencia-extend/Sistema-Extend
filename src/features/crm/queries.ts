import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ActivityKind, LeadSource, StageKind } from "@/domain/crm";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export type Stage = { id: string; name: string; position: number; color: string; kind: StageKind; slaDays: number | null };
export type Pipeline = { id: string; name: string; isDefault: boolean; stages: Stage[] };

export const listPipelines = cache(async (): Promise<Pipeline[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pipelines")
    .select("id, name, is_default, position, pipeline_stages(id, name, position, color, kind, sla_days)")
    .order("is_default", { ascending: false })
    .order("position")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    isDefault: p.is_default,
    stages: (p.pipeline_stages ?? [])
      .map((s) => ({ id: s.id, name: s.name, position: s.position, color: s.color, kind: s.kind as StageKind, slaDays: s.sla_days }))
      .sort((a, b) => a.position - b.position),
  }));
});

export type LeadRow = {
  id: string;
  pipelineId: string;
  stageId: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  valueCents: number | null;
  ownerId: string | null;
  ownerName: string | null;
  stageChangedAt: string;
  createdAt: string;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  wonClientId: string | null;
  nextAction: { body: string; dueAt: string } | null;
};

const LEAD_SELECT =
  "id, pipeline_id, stage_id, name, company, phone, email, source, value_cents, owner_id, stage_changed_at, created_at, won_at, lost_at, lost_reason, won_client_id, owner:profiles!leads_owner_id_fkey(full_name, email)";

type RawLead = {
  id: string;
  pipeline_id: string;
  stage_id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  value_cents: number | null;
  owner_id: string | null;
  stage_changed_at: string;
  created_at: string;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  won_client_id: string | null;
  owner: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
};

const toLead = (r: RawLead, next?: Map<string, { body: string; dueAt: string }>): LeadRow => {
  const o = one(r.owner);
  return {
    id: r.id,
    pipelineId: r.pipeline_id,
    stageId: r.stage_id,
    name: r.name,
    company: r.company,
    phone: r.phone,
    email: r.email,
    source: r.source as LeadSource,
    valueCents: r.value_cents,
    ownerId: r.owner_id,
    ownerName: o ? o.full_name || o.email : null,
    stageChangedAt: r.stage_changed_at,
    createdAt: r.created_at,
    wonAt: r.won_at,
    lostAt: r.lost_at,
    lostReason: r.lost_reason,
    wonClientId: r.won_client_id,
    nextAction: next?.get(r.id) ?? null,
  };
};

/** Leads de um funil (a RLS já limita a "só os meus" quando for o caso), com a próxima ação aberta. */
export async function listLeads(pipelineId: string): Promise<LeadRow[]> {
  const supabase = await createClient();
  const [{ data, error }, { data: acts, error: e2 }] = await Promise.all([
    supabase.from("leads").select(LEAD_SELECT).eq("pipeline_id", pipelineId).order("stage_changed_at", { ascending: false }).limit(2000),
    supabase
      .from("lead_activities")
      .select("lead_id, body, due_at, leads!inner(pipeline_id)")
      .eq("leads.pipeline_id", pipelineId)
      .is("done_at", null)
      .not("due_at", "is", null)
      .order("due_at"),
  ]);
  if (error) throw error;
  if (e2) throw e2;
  const next = new Map<string, { body: string; dueAt: string }>();
  for (const a of acts ?? []) if (!next.has(a.lead_id)) next.set(a.lead_id, { body: a.body, dueAt: a.due_at! });
  return (data ?? []).map((r) => toLead(r as RawLead, next));
}

/** Todos os leads visíveis, para o painel (só os campos que ele usa). */
export async function listLeadsForPanel() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("stage_id, pipeline_id, source, value_cents, owner_id, created_at, won_at, lost_at, lost_reason")
    .limit(10000);
  if (error) throw error;
  return (data ?? []).map((l) => ({
    pipelineId: l.pipeline_id,
    stageId: l.stage_id,
    source: l.source as LeadSource,
    valueCents: l.value_cents,
    ownerId: l.owner_id,
    createdAt: l.created_at,
    wonAt: l.won_at,
    lostAt: l.lost_at,
    lostReason: l.lost_reason,
  }));
}

export type Activity = { id: string; kind: ActivityKind | "etapa" | "sistema"; body: string; dueAt: string | null; doneAt: string | null; createdAt: string; author: string | null };

export type LeadDetail = LeadRow & {
  notes: string | null;
  utm: { source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null };
  createdBy: string | null;
  importId: string | null;
  activities: Activity[];
};

export async function getLead(id: string): Promise<LeadDetail | null> {
  const supabase = await createClient();
  const [{ data, error }, { data: acts, error: e2 }] = await Promise.all([
    supabase.from("leads").select(`${LEAD_SELECT}, notes, utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_by, import_id`).eq("id", id).maybeSingle(),
    supabase
      .from("lead_activities")
      .select("id, kind, body, due_at, done_at, created_at, author:profiles!lead_activities_created_by_fkey(full_name, email)")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  if (error) throw error;
  if (e2) throw e2;
  if (!data) return null;
  const activities: Activity[] = (acts ?? []).map((a) => {
    const au = one(a.author as { full_name: string; email: string } | null);
    return { id: a.id, kind: a.kind as Activity["kind"], body: a.body, dueAt: a.due_at, doneAt: a.done_at, createdAt: a.created_at, author: au ? au.full_name || au.email : null };
  });
  const open = activities.filter((a) => a.dueAt && !a.doneAt).sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))[0];
  return {
    ...toLead(data as RawLead),
    nextAction: open ? { body: open.body, dueAt: open.dueAt! } : null,
    notes: data.notes,
    utm: { source: data.utm_source, medium: data.utm_medium, campaign: data.utm_campaign, content: data.utm_content, term: data.utm_term },
    createdBy: data.created_by,
    importId: data.import_id,
    activities,
  };
}

/** Quem pode ser responsável por lead (tem acesso ao comercial). */
export const listCrmPeople = cache(async (): Promise<{ id: string; name: string }[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_people");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name }));
});

export type LeadImportRow = { id: string; fileName: string; rowCount: number; duplicates: number; undoneAt: string | null; createdAt: string };

export async function listLeadImports(): Promise<LeadImportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lead_imports").select("id, file_name, row_count, duplicates, undone_at, created_at").order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []).map((i) => ({ id: i.id, fileName: i.file_name, rowCount: i.row_count, duplicates: i.duplicates, undoneAt: i.undone_at, createdAt: i.created_at }));
}
