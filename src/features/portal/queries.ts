import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ContentFormat } from "@/domain/media";

/**
 * Leituras da área do cliente. Tudo passa pelas funções portal_* do banco, que conferem o acesso
 * (usuário do cliente ou prévia da equipe) e devolvem só o que o cliente pode ver.
 */

export type PortalHome = {
  client: { id: string; name: string; segment: string | null; status: string };
  owner: { name: string } | null;
  services: { name: string; qty: number | null; unit: string | null }[];
  milestones: { title: string; due_on: string | null; done_at: string | null }[];
  month: { number: number; starts_on: string; ends_on: string; services: { name: string; total: number; done: number }[] } | null;
  pending_approvals: number;
  next_posts: { title: string; post_on: string; format: ContentFormat | null }[];
  strategy_at: string | null;
  latest_report: { name: string; created_at: string } | null;
};

export const portalHome = cache(async (clientId: string): Promise<PortalHome> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_home", { p_client: clientId });
  if (error) throw error;
  return data as unknown as PortalHome;
});

export type PortalPost = {
  taskId: string;
  title: string;
  format: ContentFormat | null;
  caption: string | null;
  postOn: string | null;
  postUrl: string | null;
  finalUrl: string | null;
  coverUrl: string | null;
  done: boolean;
};

/** Signed URLs (o acesso já foi conferido pela função do portal). */
async function sign(paths: string[], seconds: number) {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length || !process.env.SUPABASE_SECRET_KEY) return out;
  const { data } = await createAdminClient().storage.from("anexos").createSignedUrls(unique, seconds);
  for (const u of data ?? []) if (u.path && u.signedUrl) out.set(u.path, u.signedUrl);
  return out;
}

export async function portalSchedule(clientId: string, start: string, end: string): Promise<PortalPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_schedule", { p_client: clientId, p_start: start, p_end: end });
  if (error) throw error;
  const signed = await sign(data.map((r) => r.cover_path ?? "").filter(Boolean), 600);
  return data.map((r) => ({
    taskId: r.task_id,
    title: r.title,
    format: r.format as ContentFormat | null,
    caption: r.caption,
    postOn: r.post_on,
    postUrl: r.post_url,
    finalUrl: r.final_url,
    coverUrl: r.cover_path ? (signed.get(r.cover_path) ?? null) : null,
    done: r.done,
  }));
}

type RawAsset = { id: string; name: string; kind: "arquivo" | "link"; path: string | null; url: string | null; mime: string | null };
type RawPending = {
  task_id: string;
  title: string;
  step: string;
  since: string;
  version: number | null;
  caption: string | null;
  script: string | null;
  copy: string | null;
  cta: string | null;
  assets: RawAsset[];
};
export type PortalPending = Omit<RawPending, "assets"> & { assets: { id: string; name: string; url: string | null; mimeType: string | null; isFile: boolean }[] };
export type PortalDecision = { title: string; decision: "aprovado" | "ajustes"; comment: string | null; name: string | null; decided_at: string };

export async function portalApprovals(clientId: string): Promise<{ pending: PortalPending[]; history: PortalDecision[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_approvals", { p_client: clientId });
  if (error) throw error;
  const raw = data as unknown as { pending: RawPending[]; history: PortalDecision[] };
  const signed = await sign(raw.pending.flatMap((p) => p.assets.map((a) => a.path ?? "")), 3600);
  return {
    pending: raw.pending.map((p) => ({
      ...p,
      assets: p.assets.map((a) => ({ id: a.id, name: a.name, mimeType: a.mime, isFile: a.kind === "arquivo", url: a.path ? (signed.get(a.path) ?? null) : a.url })),
    })),
    history: raw.history,
  };
}

export type PortalFile = { id: string; name: string; folder: "relatorios" | "cliente"; mime: string | null; size: number | null; created_at: string };
export type PortalContent = { title: string; format: ContentFormat | null; url: string; post_url: string | null; at: string };

export async function portalFiles(clientId: string): Promise<{ files: PortalFile[]; contents: PortalContent[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_files", { p_client: clientId });
  if (error) throw error;
  return data as unknown as { files: PortalFile[]; contents: PortalContent[] };
}

export async function portalStrategy(clientId: string): Promise<{ body: string; published_at: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_strategy", { p_client: clientId });
  if (error) throw error;
  return (data as unknown as { body: string; published_at: string } | null) ?? null;
}

/** Caminho do arquivo para baixar, conferido pelo banco (arquivo compartilhado ou versão aguardando o cliente). */
export async function portalFilePath(clientId: string, kind: "arquivo" | "versao", id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_file_path", { p_client: clientId, p_kind: kind, p_id: id });
  if (error) return null;
  return (data as string | null) ?? null;
}

// --- Lado da equipe (aba "Área do cliente" no ambiente do cliente) ---------------------------

export type PortalPeople = {
  users: { id: string; name: string; email: string; active: boolean; last_seen_at: string | null; created_at: string }[];
  invites: { id: string; name: string; email: string; expires_at: string; send_count: number; last_sent_at: string; expired: boolean }[];
};

export async function portalPeople(clientId: string): Promise<PortalPeople> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_people", { p_client: clientId });
  if (error) throw error;
  const raw = data as unknown as PortalPeople;
  const now = Date.now();
  return { ...raw, invites: raw.invites.map((i) => ({ ...i, expired: new Date(i.expires_at).getTime() < now })) };
}

/** Último acesso da pessoa do cliente (mostrado para a equipe), no máximo uma gravação a cada 10 minutos. */
export async function touchLastSeen(userId: string) {
  const supabase = await createClient();
  const now = Date.now();
  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date(now).toISOString() })
    .eq("id", userId)
    .or(`last_seen_at.is.null,last_seen_at.lt.${new Date(now - 10 * 60_000).toISOString()}`);
}

export async function canManagePortal(clientId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_manage_portal", { p_client: clientId });
  return data === true;
}

export type StrategyRow = { draft: string; published: string | null; publishedAt: string | null; publishedBy: string | null; updatedAt: string };

export async function getStrategy(clientId: string): Promise<StrategyRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_strategies")
    .select("draft, published, published_at, updated_at, publisher:profiles!client_strategies_published_by_fkey(full_name)")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const pub = Array.isArray(data.publisher) ? data.publisher[0] : data.publisher;
  return { draft: data.draft, published: data.published, publishedAt: data.published_at, publishedBy: pub?.full_name ?? null, updatedAt: data.updated_at };
}
