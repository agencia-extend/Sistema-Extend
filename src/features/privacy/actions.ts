"use server";

import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/domain/shared/result";
import { PRIVACY_VERSION } from "@/domain/privacy";
import { answerSchema, consentSchema, controllerSchema, requestSchema } from "./schemas";

const ADMIN = "/configuracoes/privacidade";
const PROFILE = "/configuracoes/perfil";

/** A pessoa registra que leu a versão atual da política e dos termos. */
export const acknowledgePolicy = defineAction({ schema: consentSchema }, async ({ version }, { user }) => {
  if (version !== PRIVACY_VERSION) return fail("business_rule", "A política foi atualizada. Recarregue a página e leia a versão nova.");
  const supabase = await createClient();
  must(await supabase.from("privacy_consents").upsert({ profile_id: user.id, version }, { onConflict: "profile_id,version", ignoreDuplicates: true }));
  revalidatePath("/", "layout");
  return ok(null, "Obrigado. Registramos que você leu a política.");
});

export const createPrivacyRequest = defineAction({ schema: requestSchema }, async ({ kind, details }, { user }) => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("privacy_requests")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("kind", kind)
    .in("status", ["aberto", "em_andamento"]);
  if ((count ?? 0) > 0) return fail("conflict", "Você já tem um pedido deste tipo em aberto. Acompanhe a resposta abaixo.");
  must(await supabase.from("privacy_requests").insert({ kind, details: details || null }));
  revalidatePath(PROFILE);
  return ok(null, "Pedido enviado. A resposta chega em até 15 dias, aqui e por aviso.");
});

export const answerPrivacyRequest = defineAction({ schema: answerSchema, permission: "privacy.manage" }, async ({ id, status, response }) => {
  const supabase = await createClient();
  must(
    await supabase
      .from("privacy_requests")
      .update({ status, response: response || null })
      .eq("id", id)
      .select("id")
      .single(),
  );
  revalidatePath(ADMIN);
  return ok(null, status === "em_andamento" ? "Pedido marcado como em andamento." : "Resposta enviada. A pessoa foi avisada.");
});

export const saveController = defineAction({ schema: controllerSchema, permission: "privacy.manage" }, async (input, { user }) => {
  const supabase = await createClient();
  must(
    await supabase.from("privacy_settings").upsert(
      {
        organization_id: user.organizationId,
        legal_name: input.legalName,
        cnpj: input.cnpj,
        address: input.address,
        dpo_name: input.dpoName,
        dpo_email: input.dpoEmail,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "organization_id" },
    ),
  );
  revalidatePath(ADMIN);
  revalidatePath("/privacidade");
  revalidatePath("/termos");
  return ok(null, "Dados do controlador salvos. A política pública já mostra as informações novas.");
});
