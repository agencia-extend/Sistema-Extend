import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/domain/media";
import { dailyPrefill, type Prefill } from "@/domain/traffic/prefill";
import { getAlertLimits } from "@/features/alerts/queries";

const shift = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export type CheckPrefill = { prefill: Prefill; syncedAt: string | null; syncError: boolean };

/**
 * Números da sincronização para o checklist diário do cliente (RF-OTI-01). Lido com o login da pessoa (a RLS só mostra
 * as contas que ela vê). Sem conta da Meta ligada e sincronizada, devolve null e o checklist abre vazio.
 */
export async function getCheckPrefill(clientId: string): Promise<CheckPrefill | null> {
  const supabase = await createClient();
  const { data: accs, error } = await supabase
    .from("ad_accounts")
    .select("id, external_id, name, is_prepay, funds_cents, account_status_code, synced_at, sync_error")
    .eq("client_id", clientId)
    .eq("is_enabled", true)
    .not("synced_at", "is", null);
  if (error) throw error;
  if (!accs?.length) return null;
  const ids = accs.map((a) => a.id);
  const today = todayKey(new Date());
  const yesterday = shift(today, -1);

  const [ins, camps, rejected, limits] = await Promise.all([
    supabase.from("ad_insights_daily").select("ad_account_id, level, object_external_id, date, spend_cents").in("ad_account_id", ids).in("level", ["account", "campaign"]).gte("date", shift(today, -7)).lte("date", yesterday),
    supabase.from("ad_campaigns").select("id, ad_account_id, external_id, name, daily_budget_cents, starts_at").in("ad_account_id", ids).eq("effective_status", "ACTIVE"),
    supabase.from("ads").select("name, ad_campaigns!inner(effective_status)").in("ad_account_id", ids).eq("effective_status", "DISAPPROVED").eq("ad_campaigns.effective_status", "ACTIVE").order("name"),
    getAlertLimits(clientId),
  ]);
  if (ins.error) throw ins.error;
  if (camps.error) throw camps.error;
  if (rejected.error) throw rejected.error;
  const rows = ins.data ?? [];
  const spend = (acc: string, level: string, obj: string, date: string) =>
    rows.filter((r) => r.ad_account_id === acc && r.level === level && r.object_external_id === obj && r.date === date).reduce((s, r) => s + Number(r.spend_cents), 0);
  const days = Array.from({ length: 7 }, (_, i) => shift(today, -7 + i));
  const startOfYesterday = new Date(`${yesterday}T03:00:00Z`).getTime(); // 00:00 em São Paulo

  const prefill = dailyPrefill({
    accounts: accs.map((a) => ({
      name: a.name,
      isPrepay: a.is_prepay,
      fundsCents: a.funds_cents === null ? null : Number(a.funds_cents),
      statusCode: a.account_status_code,
      last7SpendCents: days.map((d) => spend(a.id, "account", a.external_id, d)),
      yesterdayCents: spend(a.id, "account", a.external_id, yesterday),
    })),
    campaigns: (camps.data ?? []).map((c) => ({
      name: c.name,
      dailyBudgetCents: c.daily_budget_cents === null ? null : Number(c.daily_budget_cents),
      yesterdayCents: spend(c.ad_account_id, "campaign", c.external_id, yesterday),
      startedBeforeYesterday: !c.starts_at || new Date(c.starts_at).getTime() < startOfYesterday,
    })),
    rejectedAds: (rejected.data ?? []).map((a) => a.name),
    limits: limits.effective,
  });
  if (!prefill) return null;
  const synced = accs.map((a) => a.synced_at!).sort()[0] ?? null;
  return { prefill, syncedAt: synced, syncError: accs.some((a) => a.sync_error) };
}
