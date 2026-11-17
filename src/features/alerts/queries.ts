import "server-only";
import { tabStatus, type AlertKind, type AlertStatus, type AlertTab } from "@/domain/ads/alerts";
import type { CurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// Leitura com o login da pessoa: a RLS mostra só os alertas dos clientes cujos anúncios ela vê
// (e os de conexão da agência para quem conecta as integrações).

export type AlertRow = {
  id: string;
  kind: AlertKind;
  status: AlertStatus;
  title: string;
  body: string | null;
  href: string | null;
  clientId: string | null;
  clientName: string | null;
  openedAt: string;
  lastSeenAt: string;
  timesSeen: number;
  ackName: string | null;
  ackAt: string | null;
  resolvedById: string | null;
  resolvedName: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  /** A pessoa pode reconhecer/resolver (o banco confere de novo). */
  canAct: boolean;
};

const SELECT =
  "id, kind, status, title, body, href, client_id, opened_at, last_seen_at, times_seen, ack_at, resolved_by, resolved_at, resolution, client:clients(name), ack:profiles!ad_alerts_ack_by_fkey(full_name), solver:profiles!ad_alerts_resolved_by_fkey(full_name)";

type Raw = {
  id: string; kind: string; status: string; title: string; body: string | null; href: string | null; client_id: string | null;
  opened_at: string; last_seen_at: string; times_seen: number; ack_at: string | null; resolved_by: string | null; resolved_at: string | null; resolution: string | null;
  client: { name: string } | null; ack: { full_name: string } | null; solver: { full_name: string } | null;
};

async function withActions(rows: Raw[], user: CurrentUser): Promise<AlertRow[]> {
  const supabase = await createClient();
  const clients = [...new Set(rows.filter((r) => r.status !== "resolvido" && r.client_id).map((r) => r.client_id!))];
  const manage = new Map<string, boolean>();
  if (user.permissions["ads.manage"]) {
    const res = await Promise.all(clients.map((c) => supabase.rpc("can_manage_client_ads", { p_client: c })));
    clients.forEach((c, i) => manage.set(c, res[i].data === true));
  }
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as AlertKind,
    status: r.status as AlertStatus,
    title: r.title,
    body: r.body,
    href: r.href,
    clientId: r.client_id,
    clientName: r.client?.name ?? null,
    openedAt: r.opened_at,
    lastSeenAt: r.last_seen_at,
    timesSeen: r.times_seen,
    ackName: r.ack?.full_name || null,
    ackAt: r.ack_at,
    resolvedById: r.resolved_by,
    resolvedName: r.solver?.full_name || null,
    resolvedAt: r.resolved_at,
    resolution: r.resolution,
    canAct: r.status !== "resolvido" && (r.client_id ? manage.get(r.client_id) === true : Boolean(user.permissions["ads.connect"])),
  }));
}

/** Alertas de uma aba (resolvidos: os 100 mais recentes) e a contagem de cada situação. */
export async function getAlerts(tab: AlertTab, user: CurrentUser) {
  const supabase = await createClient();
  const status = tabStatus(tab);
  let q = supabase.from("ad_alerts").select(SELECT).eq("status", status);
  q = status === "resolvido" ? q.order("resolved_at", { ascending: false }).limit(100) : q.order("opened_at", { ascending: false }).limit(300);
  const count = (s: AlertStatus) => supabase.from("ad_alerts").select("id", { count: "exact", head: true }).eq("status", s);
  const [list, open, ack] = await Promise.all([q, count("aberto"), count("reconhecido")]);
  if (list.error) throw list.error;
  return { rows: await withActions((list.data ?? []) as unknown as Raw[], user), counts: { abertos: open.count ?? 0, reconhecidos: ack.count ?? 0 } };
}

/** Alertas em aberto (abertos e reconhecidos) de um cliente, para a aba Anúncios. */
export async function getClientOpenAlerts(clientId: string, user: CurrentUser) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ad_alerts").select(SELECT).eq("client_id", clientId).neq("status", "resolvido").order("opened_at", { ascending: false }).limit(50);
  if (error) throw error;
  return withActions((data ?? []) as unknown as Raw[], user);
}
