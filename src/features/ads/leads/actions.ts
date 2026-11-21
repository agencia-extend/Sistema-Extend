"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { clientIp, RATE_LIMIT_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { fail, ok, type ActionResult } from "@/domain/shared/result";
import { importClientLeadsSchema, publicRateSchema, rateLeadSchema } from "./schemas";

// Leads das campanhas dos clientes (RF-T2-01). A RLS só deixa quem cuida das campanhas do cliente importar e
// avaliar; o link público passa pela função do banco com a chave secreta (20261121000100_qualidade_leads.sql).

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const refresh = (clientId: string) => {
  revalidatePath(`/clientes/${clientId}/trafego`);
  revalidatePath("/anuncios/leads");
};

export const importClientLeads = defineAction({ schema: importClientLeadsSchema, permission: "optimization.manage" }, async ({ clientId, rows }, { user }) => {
  const supabase = await createClient();
  const batch = randomUUID();
  const data = must(
    await supabase
      .from("client_leads")
      .upsert(rows.map((r) => ({ ...r, organization_id: user.organizationId, client_id: clientId, import_batch: batch, created_by: user.id })), { onConflict: "client_id,external_key", ignoreDuplicates: true })
      .select("id"),
  ) as { id: string }[];
  refresh(clientId);
  const added = data?.length ?? 0;
  const repeated = rows.length - added;
  return ok(
    { added, repeated },
    `${added} ${added === 1 ? "lead importado" : "leads importados"}${repeated ? `; ${repeated} já estava${repeated === 1 ? "" : "m"} no sistema` : ""}.`,
  );
});

export const rateClientLead = defineAction({ schema: rateLeadSchema, permission: "optimization.manage" }, async ({ id, clientId, quality, note }) => {
  const supabase = await createClient();
  must(await supabase.from("client_leads").update({ quality, quality_note: quality ? note || null : null }).eq("id", id).eq("client_id", clientId).select("id").single());
  refresh(clientId);
  return ok(null, quality ? "Avaliação salva." : "Avaliação apagada.");
});

export const deleteClientLead = defineAction({ schema: z.object({ id: z.uuid(), clientId: z.uuid() }), permission: "optimization.manage" }, async ({ id, clientId }) => {
  const supabase = await createClient();
  must(await supabase.from("client_leads").delete().eq("id", id).eq("client_id", clientId).select("id").single());
  refresh(clientId);
  return ok(null, "Lead apagado.");
});

export const createLeadReviewLink = defineAction({ schema: z.object({ clientId: z.uuid() }), permission: "optimization.manage" }, async ({ clientId }) => {
  const token = randomBytes(32).toString("base64url");
  const supabase = await createClient();
  must(await supabase.rpc("create_lead_review_link", { p_client: clientId, p_token_hash: hash(token) }));
  refresh(clientId);
  return ok({ url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/avaliar-leads/${token}` }, "Link criado. Copie e mande ao cliente; o link anterior deixou de valer.");
});

export const revokeLeadReviewLink = defineAction({ schema: z.object({ clientId: z.uuid() }), permission: "optimization.manage" }, async ({ clientId }) => {
  const supabase = await createClient();
  must(await supabase.rpc("revoke_lead_review_link", { p_client: clientId }));
  refresh(clientId);
  return ok(null, "Link cancelado. Quem tinha o endereço não avalia mais.");
});

const STATE: Record<string, string> = {
  invalido: "Este link não vale mais. Peça o link atual à Agência Extend.",
  cancelado: "Este link foi cancelado. Peça o link atual à Agência Extend.",
};

/** Avaliação pelo cliente, na página pública /avaliar-leads/[código]. */
export async function rateLeadPublic(raw: unknown): Promise<ActionResult<null>> {
  const parsed = publicRateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) (fieldErrors[i.path.join(".")] ??= []).push(i.message);
    return fail("validation", parsed.error.issues[0]?.message ?? "Revise os campos.", fieldErrors);
  }
  const ip = await clientIp();
  if (!(await withinRateLimit(`leadrate:${ip}`, 300, 900))) return fail("business_rule", RATE_LIMIT_MESSAGE);
  const { token, leadId, quality, note, name } = parsed.data;
  const { data, error } = await createAdminClient().rpc("rate_client_lead", { p_token_hash: hash(token), p_lead: leadId, p_quality: quality as string, p_note: note, p_name: name });
  if (error) {
    if (error.code === "P0001") return fail("validation", error.message);
    console.error("[rateLeadPublic]", error.code);
    return fail("unknown", "Não foi possível salvar agora. Tente de novo em instantes.");
  }
  if (data !== "ok") return fail("business_rule", STATE[data as string] ?? STATE.invalido);
  return ok(null, quality ? "Avaliação salva." : "Avaliação apagada.");
}
