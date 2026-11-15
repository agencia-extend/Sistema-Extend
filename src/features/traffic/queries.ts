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
  source: "manual" | "sync";
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
    source: r.source as "manual" | "sync",
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
