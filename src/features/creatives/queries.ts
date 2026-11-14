import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CreativeFormat, LibraryStatus } from "@/domain/creatives";

const arr = <T,>(v: T | T[] | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);

export type CreativeCard = {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  campaign: string;
  format: CreativeFormat;
  angle: string;
  priority: string;
  dueAt: string | null;
  step: string | null;
  stepColor: string;
  requestedBy: string | null;
  requesterName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: string;
};

type RawCard = {
  id: string;
  title: string;
  client_id: string;
  priority: string;
  due_at: string | null;
  assignee_id: string | null;
  created_at: string;
  clients: { name: string } | { name: string }[] | null;
  workflow_steps: { name: string; color: string } | { name: string; color: string }[] | null;
  assignee: { full_name: string } | { full_name: string }[] | null;
  creative_requests: { campaign: string; format: string; angle: string; requested_by: string | null; requester: { full_name: string } | { full_name: string }[] | null } | null;
};

/** Criativos que a pessoa vê (a RLS filtra por cliente e por quem participa). */
export async function listCreatives(): Promise<CreativeCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, client_id, priority, due_at, assignee_id, created_at, clients(name), workflow_steps(name, color), assignee:profiles!tasks_assignee_id_fkey(full_name), creative_requests!inner(campaign, format, angle, requested_by, requester:profiles!creative_requests_requested_by_fkey(full_name))",
    )
    .eq("type", "criativo")
    .is("deleted_at", null)
    .neq("status", "cancelado")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw error;
  return (data as unknown as RawCard[]).map((t) => {
    const r = t.creative_requests!;
    const step = arr(t.workflow_steps)[0];
    return {
      id: t.id,
      title: t.title,
      clientId: t.client_id,
      clientName: arr(t.clients)[0]?.name ?? "",
      campaign: r.campaign,
      format: r.format as CreativeFormat,
      angle: r.angle,
      priority: t.priority,
      dueAt: t.due_at,
      step: step?.name ?? null,
      stepColor: step?.color ?? "#64748B",
      requestedBy: r.requested_by,
      requesterName: arr(r.requester)[0]?.full_name ?? null,
      assigneeId: t.assignee_id,
      assigneeName: arr(t.assignee)[0]?.full_name ?? null,
      createdAt: t.created_at,
    };
  });
}

export type Asset = { id: string; kind: "arquivo" | "link"; name: string; url: string | null; mimeType: string | null };
export type Delivery = { id: string; version: number; note: string | null; createdAt: string; author: string | null; assets: Asset[]; comments: { id: string; body: string; author: string; createdAt: string }[] };

/** Versões de uma demanda com links assinados (10 minutos) dos arquivos. */
export async function listDeliveries(taskId: string): Promise<Delivery[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_deliveries")
    .select("id, version, note, created_at, profiles!task_deliveries_created_by_fkey(full_name), delivery_assets(id, kind, name, storage_path, url, mime_type), delivery_comments(id, body, created_at, profiles!delivery_comments_author_id_fkey(full_name))")
    .eq("task_id", taskId)
    .order("version", { ascending: false });
  if (error) throw error;
  const paths = data.flatMap((d) => arr(d.delivery_assets).map((a) => a.storage_path)).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("anexos").createSignedUrls(paths, 600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  return data.map((d) => ({
    id: d.id,
    version: d.version,
    note: d.note,
    createdAt: d.created_at,
    author: arr(d.profiles)[0]?.full_name ?? null,
    assets: arr(d.delivery_assets).map((a) => ({
      id: a.id,
      kind: a.kind as Asset["kind"],
      name: a.name,
      url: a.storage_path ? (signed.get(a.storage_path) ?? null) : a.url,
      mimeType: a.mime_type,
    })),
    comments: arr(d.delivery_comments)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({ id: c.id, body: c.body, createdAt: c.created_at, author: arr(c.profiles)[0]?.full_name ?? "" })),
  }));
}

export async function getCreative(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(
      "id, title, client_id, priority, due_at, assignee_id, status, clients(name), workflow_steps(name, color), assignee:profiles!tasks_assignee_id_fkey(full_name), creative_requests!inner(*, requester:profiles!creative_requests_requested_by_fkey(full_name))",
    )
    .eq("id", id)
    .eq("type", "criativo")
    .maybeSingle();
  if (!data) return null;
  const [links, deliveries] = await Promise.all([
    supabase.from("approval_links").select("id, created_at, expires_at, revoked_at, decided_at, decision, comment, reviewer_name").eq("task_id", id).order("created_at", { ascending: false }),
    listDeliveries(id),
  ]);
  const r = data.creative_requests as unknown as Record<string, unknown> & { requester: { full_name: string } | null };
  return {
    id: data.id,
    title: data.title,
    clientId: data.client_id as string,
    clientName: arr(data.clients as { name: string } | null)[0]?.name ?? "",
    priority: data.priority,
    dueAt: data.due_at,
    assigneeId: data.assignee_id,
    assigneeName: arr(data.assignee as { full_name: string } | null)[0]?.full_name ?? null,
    step: arr(data.workflow_steps as { name: string; color: string } | null)[0] ?? null,
    request: {
      campaign: r.campaign as string,
      objective: r.objective as string,
      format: r.format as CreativeFormat,
      quantity: r.quantity as number,
      variations: r.variations as number,
      angle: r.angle as string,
      audience: r.audience as string,
      cta: r.cta as string,
      copySuggestion: (r.copy_suggestion as string | null) ?? null,
      references: (r.reference_links as string[]) ?? [],
      notes: (r.notes as string | null) ?? null,
      requestedBy: (r.requested_by as string | null) ?? null,
      requesterName: arr(r.requester)[0]?.full_name ?? null,
    },
    links: (links.data ?? []).map((l) => ({ id: l.id, createdAt: l.created_at, expiresAt: l.expires_at, revokedAt: l.revoked_at, decidedAt: l.decided_at, decision: l.decision, comment: l.comment, reviewerName: l.reviewer_name })),
    deliveries,
  };
}

export type LibraryItem = {
  id: string;
  taskId: string;
  clientId: string;
  clientName: string;
  campaign: string;
  format: CreativeFormat;
  angle: string;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  status: LibraryStatus;
  approvedAt: string;
  previewUrl: string | null;
  previewKind: "imagem" | "video" | "link" | null;
};

/** Biblioteca: criativos aprovados, com a prévia da versão aprovada. */
export async function listLibrary(): Promise<LibraryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_library")
    .select("id, task_id, client_id, campaign, format, angle, primary_text, headline, description, status, approved_at, clients(name), task_deliveries(delivery_assets(kind, storage_path, url, mime_type))")
    .order("approved_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const first = (d: unknown) => arr((arr(d as { delivery_assets: unknown }[])[0]?.delivery_assets ?? []) as { kind: string; storage_path: string | null; url: string | null; mime_type: string | null }[])[0];
  const paths = data.map((l) => first(l.task_deliveries)?.storage_path).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("anexos").createSignedUrls(paths, 600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  return data.map((l) => {
    const a = first(l.task_deliveries);
    const url = a?.storage_path ? (signed.get(a.storage_path) ?? null) : (a?.url ?? null);
    return {
      id: l.id,
      taskId: l.task_id,
      clientId: l.client_id,
      clientName: arr(l.clients as { name: string } | null)[0]?.name ?? "",
      campaign: l.campaign,
      format: l.format as CreativeFormat,
      angle: l.angle,
      primaryText: l.primary_text,
      headline: l.headline,
      description: l.description,
      status: l.status as LibraryStatus,
      approvedAt: l.approved_at,
      previewUrl: url,
      previewKind: !a ? null : a.mime_type?.startsWith("image/") ? "imagem" : a.mime_type?.startsWith("video/") ? "video" : "link",
    };
  });
}

/** Painel do pedido: resumo operacional do onboarding e os últimos criativos do cliente. */
export async function clientContext(clientId: string) {
  const supabase = await createClient();
  const [summary, lib] = await Promise.all([
    supabase.rpc("client_operational_summary", { p_client: clientId }),
    supabase.from("creative_library").select("id, angle, format, status, approved_at").eq("client_id", clientId).in("status", ["vencedor", "reprovado_meta", "fadigado"]).order("approved_at", { ascending: false }).limit(6),
  ]);
  return { summary: summary.data ?? [], history: lib.data ?? [] };
}

export async function listRequestableClients(): Promise<{ id: string; name: string; code: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, name, code").is("deleted_at", null).in("status", ["ativo", "onboarding"]).order("name");
  if (error) throw error;
  return data;
}
