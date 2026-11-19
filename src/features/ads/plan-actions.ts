"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { fail, ok } from "@/domain/shared/result";
import { createClient } from "@/lib/supabase/server";
import { getPlanOptions } from "./plan-queries";
import { planLinkSchema, planSchema, planStatusSchema } from "./plan-schemas";

// Plano de campanha (RF-PLA-01/02). A RLS só deixa quem otimiza as contas do cliente; o vínculo automático e os
// avisos acontecem no banco (20261119000400_planos_campanha.sql).

const refresh = (clientId: string) => {
  revalidatePath(`/clientes/${clientId}/trafego`);
  revalidatePath("/anuncios/planos");
};

export const savePlan = defineAction({ schema: planSchema, permission: "optimization.manage" }, async ({ id, clientId, libraryIds, requestIds, ...v }) => {
  const supabase = await createClient();
  const row = {
    name: v.name,
    platform: v.platform,
    objective: v.objective,
    budget_type: v.budgetType,
    budget_cents: v.budgetCents,
    audience: v.audience,
    start_date: v.startDate,
    end_date: v.endDate || null,
    notes: v.notes || null,
  };
  let planId = id;
  if (id) {
    const { data, error } = await supabase.from("campaign_plans").update(row).eq("id", id).select("id, campaign_id");
    if (error) throw error;
    if (!data?.length) return fail("forbidden", "Você não pode alterar este plano.");
  } else {
    planId = must(await supabase.from("campaign_plans").insert({ ...row, client_id: clientId }).select("id").single()).id;
  }
  // Criativos: troca a lista inteira pela escolhida.
  const { data: current } = await supabase.from("campaign_plan_creatives").select("id, library_id, request_task_id").eq("plan_id", planId!);
  const keep = new Set([...libraryIds.map((x) => `l:${x}`), ...requestIds.map((x) => `r:${x}`)]);
  const have = new Set((current ?? []).map((c) => (c.library_id ? `l:${c.library_id}` : `r:${c.request_task_id}`)));
  const drop = (current ?? []).filter((c) => !keep.has(c.library_id ? `l:${c.library_id}` : `r:${c.request_task_id}`)).map((c) => c.id);
  if (drop.length) must(await supabase.from("campaign_plan_creatives").delete().in("id", drop).select("id"));
  const add = [
    ...libraryIds.filter((x) => !have.has(`l:${x}`)).map((x) => ({ plan_id: planId!, library_id: x })),
    ...requestIds.filter((x) => !have.has(`r:${x}`)).map((x) => ({ plan_id: planId!, request_task_id: x })),
  ];
  if (add.length) must(await supabase.from("campaign_plan_creatives").insert(add).select("id"));

  const { data: linked } = await supabase.from("campaign_plans").select("campaign_id, link_source").eq("id", planId!).single();
  refresh(clientId);
  const tail = linked?.campaign_id && linked.link_source === "auto" ? " Já está ligado à campanha com este nome." : "";
  return ok({ id: planId! }, id ? `Plano atualizado.${tail}` : `Plano criado. A equipe de tráfego do cliente foi avisada.${tail}`);
});

export const setPlanStatus = defineAction({ schema: planStatusSchema, permission: "optimization.manage" }, async ({ id, clientId, status, approvedBy, approvedOn }) => {
  const supabase = await createClient();
  const row = status === "aprovado" ? { status, approved_by: approvedBy, approved_on: approvedOn } : { status };
  const { data, error } = await supabase.from("campaign_plans").update(row).eq("id", id).select("status");
  if (error) throw error;
  if (!data?.length) return fail("forbidden", "Você não pode alterar este plano.");
  refresh(clientId);
  const now = data[0].status;
  if (status === "aprovado" && now === "no_ar") return ok(null, "Aprovação registrada. A campanha ligada já está ativa: o plano está no ar.");
  const msg: Record<string, string> = { rascunho: "Plano voltou para rascunho.", aprovado: "Aprovação do cliente registrada.", no_ar: "Plano no ar.", encerrado: "Plano encerrado." };
  return ok(null, msg[now] ?? "Situação atualizada.");
});

export const linkPlanCampaign = defineAction({ schema: planLinkSchema, permission: "optimization.manage" }, async ({ id, clientId, campaignId }) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("campaign_plans").update({ campaign_id: campaignId }).eq("id", id).select("id");
  if (error) {
    if (error.code === "23505") return fail("conflict", "Esta campanha já está ligada a outro plano.");
    if (error.code === "P0001") return fail("validation", error.message);
    throw error;
  }
  if (!data?.length) return fail("forbidden", "Você não pode alterar este plano.");
  refresh(clientId);
  return ok(null, campaignId ? "Campanha ligada ao plano." : "Campanha solta do plano.");
});

/** Campanhas, criativos e pedidos do cliente para o formulário do plano (a RLS filtra). */
export const loadPlanOptions = defineAction({ schema: z.object({ clientId: z.uuid() }), permission: "optimization.manage" }, async ({ clientId }) =>
  ok(await getPlanOptions(clientId)),
);

export const deletePlan = defineAction({ schema: z.object({ id: z.uuid(), clientId: z.uuid() }), permission: "optimization.manage" }, async ({ id, clientId }) => {
  const supabase = await createClient();
  const { data } = await supabase.from("campaign_plans").delete().eq("id", id).select("id");
  if (!data?.length) return fail("forbidden", "Você não pode apagar este plano.");
  refresh(clientId);
  return ok(null, "Plano apagado.");
});
