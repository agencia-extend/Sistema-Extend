import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const arr = <T,>(v: T | T[] | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);

export type PublicApproval = {
  state: "aberto" | "usado" | "substituido" | "expirado";
  title: string;
  clientName: string;
  copy: string | null;
  cta: string | null;
  version: number | null;
  assets: { id: string; name: string; url: string | null; mimeType: string | null }[];
  decision: { value: string; comment: string | null; name: string | null; at: string } | null;
};

/** Dados da página pública /aprovar/[código]. Só o hash do código é consultado. */
export async function getPublicApproval(token: string): Promise<PublicApproval | null> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token) || !process.env.SUPABASE_SECRET_KEY) return null;
  const admin = createAdminClient();
  const { data: l } = await admin
    .from("approval_links")
    .select("id, task_id, delivery_id, expires_at, revoked_at, decided_at, decision, comment, reviewer_name")
    .eq("token_hash", createHash("sha256").update(token).digest("hex"))
    .maybeSingle();
  if (!l) return null;
  const [{ data: task }, { data: req }, { data: delivery }] = await Promise.all([
    admin.from("tasks").select("title, clients(name)").eq("id", l.task_id).maybeSingle(),
    admin.from("creative_requests").select("angle, copy_suggestion, cta").eq("task_id", l.task_id).maybeSingle(),
    l.delivery_id ? admin.from("task_deliveries").select("version, delivery_assets(id, name, storage_path, url, mime_type)").eq("id", l.delivery_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const assets = arr(delivery?.delivery_assets);
  const paths = assets.map((a) => a.storage_path).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await admin.storage.from("anexos").createSignedUrls(paths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const state = l.decided_at ? "usado" : l.revoked_at ? "substituido" : l.expires_at < new Date().toISOString() ? "expirado" : "aberto";
  return {
    state,
    title: req?.angle ?? task?.title ?? "Conteúdo",
    clientName: arr(task?.clients as { name: string } | null)[0]?.name ?? "",
    copy: req?.copy_suggestion ?? null,
    cta: req?.cta ?? null,
    version: delivery?.version ?? null,
    assets: assets.map((a) => ({ id: a.id, name: a.name, mimeType: a.mime_type, url: a.storage_path ? (signed.get(a.storage_path) ?? null) : a.url })),
    decision: l.decided_at ? { value: l.decision!, comment: l.comment, name: l.reviewer_name, at: l.decided_at } : null,
  };
}
