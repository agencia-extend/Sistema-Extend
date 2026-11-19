import "server-only";
import { kpis, resultKind, sumDays, type DailyMetrics, type Kpis, type ResultKind, type Totals } from "@/domain/ads";
import { plannedTotalCents, planPace, spendWindow, type Pace, type PlanObjective, type PlanPlatform, type PlanStatus } from "@/domain/ads/plans";
import { createClient } from "@/lib/supabase/server";

// Plano de campanha (RF-PLA-01/02): os planos com a campanha ligada e o que ela já gastou dentro do período do plano.

export type PlanCreative = { kind: "library" | "request"; id: string; label: string };
export type PlanRow = {
  id: string; clientId: string; clientName: string; name: string; platform: PlanPlatform; objective: PlanObjective;
  budgetType: "diario" | "total"; budgetCents: number; plannedTotalCents: number | null; audience: string; startDate: string; endDate: string | null;
  status: PlanStatus; approvedBy: string | null; approvedOn: string | null; notes: string | null; authorName: string | null;
  campaign: { id: string; name: string; status: string | null; linkSource: "auto" | "manual" } | null;
  creatives: PlanCreative[];
  spent: { totals: Totals; kind: ResultKind; kpis: Kpis; from: string; to: string } | null;
  pace: Pace | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const FORMAT: Record<string, string> = { imagem: "Imagem", video: "Vídeo", story: "Story", carrossel: "Carrossel", reels: "Reels" };

type Raw = {
  id: string; client_id: string; name: string; platform: string; objective: string; budget_type: string; budget_cents: number; audience: string;
  start_date: string; end_date: string | null; status: string; approved_by: string | null; approved_on: string | null; notes: string | null;
  campaign_id: string | null; link_source: string | null;
  clients: { name: string } | { name: string }[] | null;
  author: { full_name: string } | { full_name: string }[] | null;
  ad_campaigns: { id: string; name: string; effective_status: string | null; external_id: string; ad_account_id: string; objective: string | null } | null;
  campaign_plan_creatives: {
    library_id: string | null; request_task_id: string | null;
    creative_library: { ref_number: number; campaign: string; angle: string | null; format: string } | null;
    creative_requests: { campaign: string; format: string; tasks: { title: string } | null } | null;
  }[];
};

/** Planos que a pessoa vê (a RLS filtra), de um cliente ou de todos, os mais recentes primeiro. */
export async function listPlans(opts: { clientId?: string; status?: PlanStatus }, today: string): Promise<PlanRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("campaign_plans")
    .select(
      "id, client_id, name, platform, objective, budget_type, budget_cents, audience, start_date, end_date, status, approved_by, approved_on, notes, campaign_id, link_source, clients(name), author:profiles!campaign_plans_created_by_fkey(full_name), ad_campaigns(id, name, effective_status, external_id, ad_account_id, objective), campaign_plan_creatives(library_id, request_task_id, creative_library(ref_number, campaign, angle, format), creative_requests(campaign, format, tasks(title)))",
    )
    .order("start_date", { ascending: false })
    .limit(200);
  if (opts.clientId) q = q.eq("client_id", opts.clientId);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as Raw[];

  // Gasto da campanha ligada dentro do período do plano (até hoje).
  const linked = rows.filter((r) => r.ad_campaigns && spendWindow(r.start_date, r.end_date, today));
  const insights = new Map<string, Record<string, unknown>[]>();
  if (linked.length) {
    const from = linked.map((r) => r.start_date).sort()[0];
    const { data: ins } = await supabase
      .from("ad_insights_daily")
      .select("*")
      .eq("level", "campaign")
      .in("ad_account_id", [...new Set(linked.map((r) => r.ad_campaigns!.ad_account_id))])
      .in("object_external_id", [...new Set(linked.map((r) => r.ad_campaigns!.external_id))])
      .gte("date", from)
      .lte("date", today)
      .limit(20000);
    for (const i of ins ?? []) {
      const k = `${i.ad_account_id}:${i.object_external_id}`;
      insights.set(k, [...(insights.get(k) ?? []), i]);
    }
  }

  return rows.map((r) => {
    const c = r.ad_campaigns;
    const plan = { budgetType: r.budget_type as "diario" | "total", budgetCents: Number(r.budget_cents), startDate: r.start_date, endDate: r.end_date };
    const w = spendWindow(r.start_date, r.end_date, today);
    let spent: PlanRow["spent"] = null;
    if (c && w) {
      const days = (insights.get(`${c.ad_account_id}:${c.external_id}`) ?? []).filter((i) => String(i.date) >= w.start && String(i.date) <= w.end);
      const totals = sumDays(days as Partial<DailyMetrics>[]);
      const kind = resultKind(c.objective, totals);
      spent = { totals, kind, kpis: kpis(totals, kind), from: w.start, to: w.end };
    }
    return {
      id: r.id, clientId: r.client_id, clientName: one(r.clients)?.name ?? "", name: r.name, platform: r.platform as PlanPlatform, objective: r.objective as PlanObjective,
      budgetType: plan.budgetType, budgetCents: plan.budgetCents, plannedTotalCents: plannedTotalCents(plan), audience: r.audience,
      startDate: r.start_date, endDate: r.end_date, status: r.status as PlanStatus, approvedBy: r.approved_by, approvedOn: r.approved_on, notes: r.notes,
      authorName: one(r.author)?.full_name ?? null,
      campaign: c ? { id: c.id, name: c.name, status: c.effective_status, linkSource: (r.link_source ?? "manual") as "auto" | "manual" } : null,
      creatives: (r.campaign_plan_creatives ?? []).map((x) =>
        x.library_id
          ? { kind: "library" as const, id: x.library_id, label: x.creative_library ? `CR-${x.creative_library.ref_number} · ${FORMAT[x.creative_library.format] ?? x.creative_library.format} · ${x.creative_library.angle ?? x.creative_library.campaign}` : "Criativo da biblioteca" }
          : { kind: "request" as const, id: x.request_task_id!, label: x.creative_requests ? `Pedido: ${one(x.creative_requests.tasks)?.title ?? x.creative_requests.campaign} · ${FORMAT[x.creative_requests.format] ?? x.creative_requests.format}` : "Pedido de criativo" },
      ),
      spent,
      pace: spent && r.status === "no_ar" ? planPace(plan, spent.totals.spend_cents, today) : null,
    };
  });
}

export type PlanOptions = {
  campaigns: { id: string; name: string; status: string | null; platform: PlanPlatform; taken: boolean }[];
  library: { id: string; label: string }[];
  requests: { id: string; label: string }[];
};

/** O que dá para ligar ao plano de um cliente: campanhas das contas dele, criativos da biblioteca e pedidos em aberto. */
export async function getPlanOptions(clientId: string): Promise<PlanOptions> {
  const supabase = await createClient();
  const { data: accounts } = await supabase.from("ad_accounts").select("id, provider").eq("client_id", clientId);
  const accIds = (accounts ?? []).map((a) => a.id);
  const provider = new Map((accounts ?? []).map((a) => [a.id, a.provider as PlanPlatform]));
  const [{ data: camps }, { data: taken }, { data: lib }, { data: reqs }] = await Promise.all([
    accIds.length
      ? supabase.from("ad_campaigns").select("id, name, effective_status, ad_account_id").in("ad_account_id", accIds).order("last_seen_at", { ascending: false }).limit(300)
      : Promise.resolve({ data: [] as { id: string; name: string; effective_status: string | null; ad_account_id: string }[] }),
    supabase.from("campaign_plans").select("campaign_id").eq("client_id", clientId).not("campaign_id", "is", null),
    supabase.from("creative_library").select("id, ref_number, campaign, angle, format").eq("client_id", clientId).neq("status", "arquivado").order("approved_at", { ascending: false }).limit(100),
    supabase
      .from("tasks")
      .select("id, title, creative_requests!inner(format)")
      .eq("client_id", clientId)
      .eq("type", "criativo")
      .is("deleted_at", null)
      .in("status", ["pendente", "em_andamento", "aguardando_aprovacao"])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const used = new Set((taken ?? []).map((t) => t.campaign_id));
  return {
    campaigns: (camps ?? []).map((c) => ({ id: c.id, name: c.name, status: c.effective_status, platform: provider.get(c.ad_account_id) ?? "meta", taken: used.has(c.id) })),
    library: (lib ?? []).map((l) => ({ id: l.id, label: `CR-${l.ref_number} · ${FORMAT[l.format] ?? l.format} · ${l.angle ?? l.campaign}` })),
    requests: (reqs ?? []).map((t) => ({ id: t.id, label: `${t.title} · ${FORMAT[one(t.creative_requests as { format: string } | { format: string }[])?.format ?? ""] ?? ""}` })),
  };
}

/** Clientes em que a pessoa pode criar plano (é da equipe de tráfego ou vê todos). */
export async function listPlanClients(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("campaign_plan_clients");
  return data ?? [];
}
