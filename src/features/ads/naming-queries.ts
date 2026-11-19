import "server-only";
import { DEFAULT_NAMING, checkName, parseNaming, type NamingLevel, type NamingPart } from "@/domain/ads/naming";
import { statusMatches, type AdsFilters } from "@/domain/ads/filters";
import { createClient } from "@/lib/supabase/server";
import { getModuleAccounts, scopedAccounts } from "./module-queries";

// Nomenclatura padrão (RF-PLA-03): o padrão da agência e o verificador do que está nas contas.

export type NamingTemplates = Record<NamingLevel, string>;

export async function getNaming(): Promise<NamingTemplates> {
  const supabase = await createClient();
  const { data } = await supabase.from("naming_conventions").select("campaign, adset, ad").maybeSingle();
  return data ?? DEFAULT_NAMING;
}

export const namingParts = (t: NamingTemplates) =>
  Object.fromEntries((Object.keys(t) as NamingLevel[]).map((k) => {
    const r = parseNaming(t[k]);
    return [k, "parts" in r ? r.parts : null];
  })) as Record<NamingLevel, NamingPart[] | null>;

export type NamingIssue = { id: string; level: NamingLevel; name: string; reason: string; status: string | null; clientId: string | null; clientName: string | null; accountName: string; parent: string | null };

/** Campanhas, conjuntos e anúncios das contas que a pessoa vê, com os que estão fora do padrão. */
export async function getNamingReport(f: AdsFilters, today: string) {
  const templates = await getNaming();
  const parts = namingParts(templates);
  const accounts = scopedAccounts(await getModuleAccounts(today), f);
  const empty = { templates, issues: [] as NamingIssue[], totals: { campaign: 0, adset: 0, ad: 0 } };
  if (!accounts.length) return empty;
  const ids = accounts.map((a) => a.id);
  const byAcc = new Map(accounts.map((a) => [a.id, a]));
  const supabase = await createClient();
  const [{ data: camps }, { data: sets }, { data: ads }] = await Promise.all([
    supabase.from("ad_campaigns").select("id, ad_account_id, name, effective_status").in("ad_account_id", ids).limit(5000),
    supabase.from("ad_sets").select("id, ad_account_id, name, effective_status, ad_campaigns(name)").in("ad_account_id", ids).limit(5000),
    supabase.from("ads").select("id, ad_account_id, name, effective_status, ad_campaigns(name)").in("ad_account_id", ids).limit(5000),
  ]);
  const totals = { campaign: 0, adset: 0, ad: 0 };
  const issues: NamingIssue[] = [];
  const parentName = (v: unknown) => ((Array.isArray(v) ? v[0] : v) as { name: string } | null)?.name ?? null;
  const visit = (level: NamingLevel, rows: { id: string; ad_account_id: string; name: string; effective_status: string | null; ad_campaigns?: unknown }[] | null) => {
    const p = parts[level];
    for (const r of rows ?? []) {
      if (!statusMatches(r.effective_status, f.status)) continue;
      totals[level]++;
      if (!p) continue;
      const c = checkName(r.name, p);
      if (c.ok) continue;
      const a = byAcc.get(r.ad_account_id)!;
      issues.push({ id: r.id, level, name: r.name, reason: c.reason, status: r.effective_status, clientId: a.clientId, clientName: a.clientName, accountName: a.name, parent: level === "campaign" ? null : parentName(r.ad_campaigns) });
    }
  };
  visit("campaign", camps);
  visit("adset", sets);
  visit("ad", ads);
  issues.sort((x, y) => (x.clientName ?? "").localeCompare(y.clientName ?? "", "pt-BR") || x.name.localeCompare(y.name, "pt-BR"));
  return { templates, issues, totals };
}
