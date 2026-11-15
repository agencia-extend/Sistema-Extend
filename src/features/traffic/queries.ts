import "server-only";
import { createClient } from "@/lib/supabase/server";

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
