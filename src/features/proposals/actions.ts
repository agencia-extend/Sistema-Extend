"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, withinRateLimit } from "@/lib/rate-limit";
import { publicEnv } from "@/lib/env";
import { fail, ok, type ActionResult } from "@/domain/shared/result";
import { normalizeEmail, normalizePhone } from "@/domain/crm";
import { acceptSchema, offerSchema, proposalSchema, refuseSchema, templateSchema } from "./schemas";

const refresh = (id?: string, leadId?: string) => {
  revalidatePath("/comercial", "layout");
  if (id) revalidatePath(`/comercial/propostas/${id}`);
  if (leadId) revalidatePath(`/comercial/leads/${leadId}`);
};

// ---------------------------------------------------------------- modelos
export const saveTemplate = defineAction({ schema: templateSchema, permission: "proposals.templates.manage" }, async (v) => {
  const supabase = await createClient();
  const row = { name: v.name, blocks: v.blocks, whatsapp_message: v.whatsappMessage, validity_days: v.validityDays };
  const res = v.id
    ? await supabase.from("proposal_templates").update(row).eq("id", v.id).select("id, version").single()
    : await supabase.from("proposal_templates").insert(row).select("id, version").single();
  if (res.error?.code === "23505") return fail("conflict", "Já existe um modelo com este nome.", { name: ["Já existe um modelo com este nome."] });
  const t = must(res) as { id: string; version: number };
  revalidatePath("/configuracoes/propostas", "layout");
  return ok(t, v.id ? `Modelo salvo (versão ${t.version}).` : "Modelo criado.");
});

export const duplicateTemplate = defineAction({ schema: z.object({ id: z.uuid() }), permission: "proposals.templates.manage" }, async ({ id }) => {
  const supabase = await createClient();
  const src = must(await supabase.from("proposal_templates").select("name, blocks, whatsapp_message, validity_days").eq("id", id).single());
  const { data: names } = await supabase.from("proposal_templates").select("name");
  const taken = new Set((names ?? []).map((n) => n.name));
  let name = `${src.name} (cópia)`.slice(0, 80);
  for (let i = 2; taken.has(name); i++) name = `${src.name} (cópia ${i})`.slice(0, 80);
  const t = must(await supabase.from("proposal_templates").insert({ name, blocks: src.blocks, whatsapp_message: src.whatsapp_message, validity_days: src.validity_days }).select("id").single());
  revalidatePath("/configuracoes/propostas", "layout");
  return ok({ id: t.id }, `Modelo duplicado como “${name}”.`);
});

export const restoreTemplateVersion = defineAction(
  { schema: z.object({ id: z.uuid(), version: z.number().int().min(1) }), permission: "proposals.templates.manage" },
  async ({ id, version }) => {
    const supabase = await createClient();
    const v = must(await supabase.from("proposal_template_versions").select("name, blocks, whatsapp_message, validity_days").eq("template_id", id).eq("version", version).single());
    const t = must(await supabase.from("proposal_templates").update({ name: v.name, blocks: v.blocks, whatsapp_message: v.whatsapp_message, validity_days: v.validity_days }).eq("id", id).select("version").single());
    revalidatePath("/configuracoes/propostas", "layout");
    return ok(null, `Versão ${version} restaurada como versão ${t.version}.`);
  },
);

export const setTemplateFlags = defineAction(
  { schema: z.object({ id: z.uuid(), isDefault: z.boolean().optional(), archived: z.boolean().optional() }), permission: "proposals.templates.manage" },
  async ({ id, isDefault, archived }) => {
    const supabase = await createClient();
    if (archived) {
      const { data } = await supabase.from("proposal_templates").select("is_default").eq("id", id).single();
      if (data?.is_default) return fail("business_rule", "Escolha outro modelo como padrão antes de arquivar este.");
    }
    const patch: { is_default?: boolean; archived_at?: string | null } = {};
    if (isDefault !== undefined) patch.is_default = isDefault;
    if (archived !== undefined) patch.archived_at = archived ? new Date().toISOString() : null;
    must(await supabase.from("proposal_templates").update(patch).eq("id", id).select("id").single());
    revalidatePath("/configuracoes/propostas", "layout");
    return ok(null, archived ? "Modelo arquivado." : archived === false ? "Modelo reativado." : "Modelo padrão definido.");
  },
);

export const saveOffer = defineAction({ schema: offerSchema, permission: "proposals.templates.manage" }, async (v) => {
  const supabase = await createClient();
  const { data: s } = await supabase.from("service_catalog").select("organization_id").eq("id", v.serviceId).single();
  if (!s) return fail("not_found", "Serviço não encontrado.");
  must(
    await supabase
      .from("service_offers")
      .upsert({ service_id: v.serviceId, organization_id: s.organization_id, description: v.description, price_cents: v.priceCents, recurrence: v.recurrence })
      .select("service_id")
      .single(),
  );
  revalidatePath("/configuracoes/propostas", "layout");
  return ok(null, "Preço e descrição salvos.");
});

// ---------------------------------------------------------------- propostas
export const saveProposal = defineAction({ schema: proposalSchema, permission: "proposals.manage" }, async (v) => {
  const supabase = await createClient();
  const id = must(
    await supabase.rpc("save_proposal", {
      p: {
        id: v.id ?? null,
        lead_id: v.leadId,
        template_id: v.templateId,
        client_name: v.clientName,
        contact_name: v.contactName,
        contact_phone: v.contactPhone ? normalizePhone(v.contactPhone) : null,
        contact_email: v.contactEmail ? normalizeEmail(v.contactEmail) : null,
        items: v.items,
        payment_terms: v.paymentTerms,
        notes: v.notes,
        valid_until: v.validUntil,
      },
    }),
  ) as string;
  refresh(id, v.leadId);
  return ok({ id }, v.id ? "Proposta salva como nova versão." : "Proposta criada.");
});

export const sendProposal = defineAction({ schema: z.object({ id: z.uuid() }), permission: "proposals.manage" }, async ({ id }) => {
  const supabase = await createClient();
  const token = must(await supabase.rpc("send_proposal", { p_id: id })) as string;
  const { data } = await supabase.from("proposals").select("lead_id").eq("id", id).single();
  refresh(id, data?.lead_id);
  return ok({ url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/proposta/${token}` }, "Proposta enviada: o link mostra esta versão.");
});

export const refuseProposal = defineAction({ schema: refuseSchema, permission: "proposals.manage" }, async ({ id, reason }) => {
  const supabase = await createClient();
  must(await supabase.rpc("refuse_proposal", { p_id: id, p_reason: reason }));
  refresh(id);
  return ok(null, "Proposta marcada como recusada.");
});

export const deleteProposal = defineAction({ schema: z.object({ id: z.uuid() }), permission: "proposals.manage" }, async ({ id }) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proposals").delete().eq("id", id).select("lead_id");
  if (error) throw error;
  if (!data?.length) return fail("business_rule", "Só um rascunho pode ser excluído. Proposta enviada fica no histórico.");
  refresh(undefined, data[0].lead_id);
  return ok(null, "Rascunho excluído.");
});

// ---------------------------------------------------------------- página pública
const MESSAGES: Record<string, string> = {
  expirada: "Esta proposta venceu. Fale com a Agência Extend para receber uma nova.",
  aceita: "Esta proposta já foi aceita.",
  recusada: "Esta proposta foi encerrada. Fale com a Agência Extend.",
  invalido: "Link inválido. Confira o endereço ou peça um novo à Agência Extend.",
};

/** Aceite do cliente pelo link (sem login). Limite por IP contra abuso. */
export async function acceptProposal(raw: unknown): Promise<ActionResult<null>> {
  const parsed = acceptSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) (fieldErrors[i.path.join(".")] ??= []).push(i.message);
    return fail("validation", parsed.error.issues[0]?.message ?? "Revise os campos.", fieldErrors);
  }
  const ip = await clientIp();
  if (!(await withinRateLimit(`proposal_accept:${ip}`, 10, 3600))) return fail("business_rule", "Muitas tentativas. Tente de novo em alguns minutos.");
  const { data, error } = await createAdminClient().rpc("accept_proposal", { p_token: parsed.data.token, p_name: parsed.data.name, p_ip: ip });
  if (error) {
    console.error("[acceptProposal]", error.code);
    return fail("unknown", error.code === "P0001" ? error.message : "Não foi possível registrar o aceite. Tente de novo.");
  }
  if (data !== "ok") return fail("business_rule", MESSAGES[data as string] ?? MESSAGES.invalido);
  revalidatePath("/comercial", "layout");
  return ok(null, "Proposta aceita. Obrigado! A Agência Extend vai falar com você para os próximos passos.");
}
