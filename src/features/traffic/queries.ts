import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CheckItem, CheckKind } from "@/domain/traffic";

export type ChangeRow = {
  id: string;
  platform: string | null;
  category: string;
  happenedOn: string;
  what: string;
  why: string;
  source: "manual" | "sync" | "sistema";
  createdBy: string | null;
  authorName: string | null;
  createdAt: string;
};

export type BudgetRow = {
  id: string;
  amountCents: number;
  platform: string;
  periodStart: string;
  periodEnd: string;
  approvedBy: string;
  approvedOn: string;
  channel: string;
  notes: string | null;
  proofPath: string | null;
  proofName: string | null;
  authorName: string | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export async function listChanges(clientId: string): Promise<ChangeRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("change_logs")
    .select("id, platform, category, happened_on, what, why, source, created_by, created_at, profiles!change_logs_created_by_fkey(full_name)")
    .eq("client_id", clientId)
    .order("happened_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    platform: r.platform,
    category: r.category,
    happenedOn: r.happened_on,
    what: r.what,
    why: r.why,
    source: r.source as "manual" | "sync" | "sistema",
    createdBy: r.created_by,
    authorName: one(r.profiles as { full_name: string } | { full_name: string }[] | null)?.full_name ?? null,
    createdAt: r.created_at,
  }));
}

export async function listBudgets(clientId: string): Promise<BudgetRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budget_approvals")
    .select("id, amount_cents, platform, period_start, period_end, approved_by, approved_on, channel, notes, client_files(storage_path, name), profiles!budget_approvals_created_by_fkey(full_name)")
    .eq("client_id", clientId)
    .order("period_start", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const f = one(r.client_files as { storage_path: string; name: string } | { storage_path: string; name: string }[] | null);
    return {
      id: r.id,
      amountCents: Number(r.amount_cents),
      platform: r.platform,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      approvedBy: r.approved_by,
      approvedOn: r.approved_on,
      channel: r.channel,
      notes: r.notes,
      proofPath: f?.storage_path ?? null,
      proofName: f?.name ?? null,
      authorName: one(r.profiles as { full_name: string } | { full_name: string }[] | null)?.full_name ?? null,
    };
  });
}

export type Decision = { level: "campanha" | "conjunto" | "anuncio"; target: string; decision: "pausar" | "manter" | "escalar"; why: string };
export type CheckRow = {
  id: string;
  kind: CheckKind;
  periodOn: string;
  items: CheckItem[];
  decisions: Decision[];
  notes: string | null;
  problems: number;
  doneAt: string;
  doneByName: string | null;
};

/** Últimos checklists do cliente (a RLS filtra quem vê o tráfego). */
export async function listChecks(clientId: string): Promise<CheckRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("traffic_checks")
    .select("id, kind, period_on, items, decisions, notes, problems, done_at, profiles!traffic_checks_done_by_fkey(full_name)")
    .eq("client_id", clientId)
    .order("period_on", { ascending: false })
    .order("kind")
    .limit(40);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind as CheckKind,
    periodOn: r.period_on,
    items: (r.items ?? []) as CheckItem[],
    decisions: (r.decisions ?? []) as Decision[],
    notes: r.notes,
    problems: r.problems,
    doneAt: r.done_at,
    doneByName: one(r.profiles as { full_name: string } | { full_name: string }[] | null)?.full_name ?? null,
  }));
}

export type RoutineRow = {
  clientId: string;
  clientName: string;
  clientCode: number | null;
  team: string[];
  daily: { doneAt: string; problems: number; by: string | null } | null;
  weekly: { doneAt: string; problems: number; decisions: number; by: string | null } | null;
  lastDailyOn: string | null;
};

/** Painel de pendências (RF-OTI-04): clientes com tráfego que a pessoa otimiza, com o checklist de hoje e o da semana. */
export async function getRoutine(): Promise<RoutineRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("traffic_routine");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    clientId: r.client_id,
    clientName: r.client_name,
    clientCode: r.client_code,
    team: r.team ?? [],
    daily: r.daily_id ? { doneAt: r.daily_done_at!, problems: r.daily_problems ?? 0, by: r.daily_by } : null,
    weekly: r.weekly_id ? { doneAt: r.weekly_done_at!, problems: r.weekly_problems ?? 0, decisions: r.weekly_decisions ?? 0, by: r.weekly_by } : null,
    lastDailyOn: r.last_daily_on,
  }));
}

export type RejectionRow = {
  id: string;
  libraryId: string | null;
  libraryCampaign: string | null;
  platform: "meta" | "google";
  rejectedOn: string;
  format: string | null;
  angle: string;
  reason: string;
  policyText: string;
  adName: string | null;
  outcome: string | null;
  lesson: string | null;
  source: "manual" | "sync" | "sistema";
  authorName: string | null;
};

/** Reprovações do cliente, mais recentes primeiro (a RLS deixa o tráfego e quem pede ou produz criativos). */
export async function listRejections(clientId: string, since?: string): Promise<RejectionRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("ad_rejections")
    .select("id, library_id, platform, rejected_on, format, angle, reason, policy_text, ad_name, outcome, lesson, source, creative_library(campaign), profiles!ad_rejections_created_by_fkey(full_name)")
    .eq("client_id", clientId)
    .order("rejected_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (since) q = q.gte("rejected_on", since);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    libraryId: r.library_id,
    libraryCampaign: one(r.creative_library as { campaign: string } | { campaign: string }[] | null)?.campaign ?? null,
    platform: r.platform as "meta" | "google",
    rejectedOn: r.rejected_on,
    format: r.format,
    angle: r.angle,
    reason: r.reason,
    policyText: r.policy_text,
    adName: r.ad_name,
    outcome: r.outcome,
    lesson: r.lesson,
    source: r.source as "manual" | "sync" | "sistema",
    authorName: one(r.profiles as { full_name: string } | { full_name: string }[] | null)?.full_name ?? null,
  }));
}

export type LibraryOption = { id: string; campaign: string; angle: string; format: string };

/** Criativos aprovados do cliente, para ligar a reprovação à peça (o formato e o ângulo vêm junto). */
export async function listLibraryOptions(clientId: string): Promise<LibraryOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_library")
    .select("id, campaign, angle, format")
    .eq("client_id", clientId)
    .neq("status", "arquivado")
    .order("approved_at", { ascending: false })
    .limit(100);
  if (error) return []; // quem não vê a biblioteca registra sem ligar à peça
  return data ?? [];
}

export type UtmLinkRow = {
  id: string;
  label: string;
  platform: "meta" | "google" | "outro";
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  term: string | null;
  content: string | null;
  url: string;
  authorName: string | null;
  createdAt: string;
};

/** Links com UTM gerados para o cliente, mais recentes primeiro (a RLS deixa quem vê o tráfego dele). */
export async function listUtmLinks(clientId: string): Promise<UtmLinkRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("utm_links")
    .select("id, label, platform, base_url, source, medium, campaign, term, content, url, created_at, profiles!utm_links_created_by_fkey(full_name)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    platform: r.platform as UtmLinkRow["platform"],
    baseUrl: r.base_url,
    source: r.source,
    medium: r.medium,
    campaign: r.campaign,
    term: r.term,
    content: r.content,
    url: r.url,
    authorName: one(r.profiles as { full_name: string } | { full_name: string }[] | null)?.full_name ?? null,
    createdAt: r.created_at,
  }));
}
