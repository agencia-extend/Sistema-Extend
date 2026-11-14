import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDoc, effectiveStatus, type Block, type ProposalSnapshot, type ProposalStatus } from "@/domain/proposals";
import type { Database } from "@/lib/supabase/database.types";

/** URLs assinadas (1 h) das imagens dos blocos. */
export async function signBlockImages(client: SupabaseClient<Database>, blocks: Block[]): Promise<Record<string, string>> {
  const paths = [...new Set(blocks.map((b) => b.imagePath).filter((p): p is string => Boolean(p)))];
  if (!paths.length) return {};
  const { data } = await client.storage.from("propostas").createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const u of data ?? []) if (u.path && u.signedUrl) out[u.path] = u.signedUrl;
  return out;
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{30,40}$/;

export type PublicProposal = {
  id: string;
  status: ProposalStatus;
  snapshot: ProposalSnapshot;
  images: Record<string, string>;
  acceptedAt: string | null;
  acceptedName: string | null;
};

/** Proposta do link público: só a versão enviada. */
export async function getPublicProposal(token: string): Promise<PublicProposal | null> {
  if (!TOKEN_RE.test(token) || !process.env.SUPABASE_SECRET_KEY) return null;
  const admin = createAdminClient();
  const { data: p } = await admin.from("proposals").select("id, status, valid_until, sent_version, accepted_at, accepted_name").eq("public_token", token).maybeSingle();
  if (!p || p.sent_version == null) return null;
  const { data: v } = await admin.from("proposal_versions").select("snapshot").eq("proposal_id", p.id).eq("version", p.sent_version).maybeSingle();
  if (!v) return null;
  const snapshot = v.snapshot as ProposalSnapshot;
  return {
    id: p.id,
    status: effectiveStatus(p.status as ProposalStatus, p.valid_until),
    snapshot,
    images: await signBlockImages(admin, snapshot.blocks),
    acceptedAt: p.accepted_at,
    acceptedName: p.accepted_name,
  };
}

export function pdfFileName(s: ProposalSnapshot): string {
  const slug = s.clientName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40);
  return `proposta-${String(s.number).padStart(4, "0")}-${slug || "cliente"}.pdf`;
}

export async function pdfResponse(snapshot: ProposalSnapshot, images: Record<string, string>, download: boolean): Promise<Response> {
  const { renderProposalPdf } = await import("./pdf/proposal-pdf");
  const buf = await renderProposalPdf(buildDoc(snapshot), images);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${pdfFileName(snapshot)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
