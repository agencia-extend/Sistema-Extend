"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { ok } from "@/domain/shared/result";
import type { Json } from "@/lib/supabase/database.types";
import { checklistTemplateSchema, formSectionsSchema, serviceCatalogSchema } from "./schemas";

const keyOf = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30) || "servico";

export const saveCatalogService = defineAction({ schema: serviceCatalogSchema, permission: "settings.manage" }, async ({ id, ...s }, { user }) => {
  const supabase = await createClient();
  if (id) {
    must(await supabase.from("service_catalog").update(s).eq("id", id).select("id").single());
  } else {
    const { count } = await supabase.from("service_catalog").select("id", { count: "exact", head: true });
    must(
      await supabase.from("service_catalog").insert({
        ...s,
        organization_id: user.organizationId,
        key: `${keyOf(s.name)}_${Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 4) || "x"}`,
        position: (count ?? 0) + 1,
      }),
    );
  }
  revalidatePath("/configuracoes/servicos");
  return ok(null, id ? "Serviço salvo." : "Serviço criado.");
});

export const saveChecklistTemplate = defineAction({ schema: checklistTemplateSchema, permission: "settings.manage" }, async ({ id, ...t }, { user }) => {
  const supabase = await createClient();
  if (id) must(await supabase.from("onboarding_checklist_templates").update(t).eq("id", id).select("id").single());
  else {
    const { count } = await supabase.from("onboarding_checklist_templates").select("id", { count: "exact", head: true });
    must(await supabase.from("onboarding_checklist_templates").insert({ ...t, organization_id: user.organizationId, position: (count ?? 0) + 1 }));
  }
  revalidatePath("/configuracoes/onboarding");
  return ok(null, "Passo salvo. Vale para os próximos clientes.");
});

export const publishForm = defineAction({ schema: formSectionsSchema, permission: "settings.manage" }, async ({ sections }) => {
  const supabase = await createClient();
  const keys = sections.flatMap((s) => s.questions.map((q) => q.key));
  if (new Set(keys).size !== keys.length) {
    return { ok: false as const, code: "validation" as const, message: "Duas perguntas estão com a mesma chave. Cada pergunta precisa de uma chave única." };
  }
  const version = must(await supabase.rpc("publish_onboarding_form", { p_sections: sections as unknown as Json })) as number;
  revalidatePath("/configuracoes/onboarding");
  return ok({ version }, `Ficha publicada (versão ${version}). Onboardings em andamento já usam o modelo novo.`);
});

export const setRecipients = defineAction({ schema: z.object({ ids: z.array(z.uuid()).max(30) }), permission: "settings.manage" }, async ({ ids }) => {
  const supabase = await createClient();
  must(await supabase.rpc("set_onboarding_recipients", { p_ids: ids }));
  revalidatePath("/configuracoes/onboarding");
  return ok(null, ids.length ? "Destinatários salvos." : "Voltou ao padrão: Coordenação de conteúdo e Gerente de tráfego.");
});
