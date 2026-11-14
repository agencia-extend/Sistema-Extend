"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { fail, ok } from "@/domain/shared/result";
import { normalizeEmail, normalizePhone } from "@/domain/crm";
import { activityDoneSchema, activitySchema, leadImportSchema, leadSchema, moveLeadSchema, moveStageSchema, pipelineSchema, stageSchema } from "./schemas";

const refresh = (leadId?: string) => {
  revalidatePath("/comercial", "layout");
  if (leadId) revalidatePath(`/comercial/leads/${leadId}`);
};
const nil = (v: string | undefined | null) => (v ? v : null);

export const saveLead = defineAction({ schema: leadSchema, permission: "crm.leads.manage" }, async (v) => {
  const supabase = await createClient();
  const row = {
    name: v.name,
    company: nil(v.company),
    phone: v.phone ? normalizePhone(v.phone) : null,
    email: v.email ? normalizeEmail(v.email) : null,
    source: v.source,
    utm_source: nil(v.utmSource),
    utm_medium: nil(v.utmMedium),
    utm_campaign: nil(v.utmCampaign),
    utm_content: nil(v.utmContent),
    utm_term: nil(v.utmTerm),
    value_cents: v.valueCents,
    owner_id: v.ownerId,
    notes: nil(v.notes),
  };
  const res = v.id
    ? await supabase.from("leads").update(row).eq("id", v.id).select("id").single()
    : await supabase.from("leads").insert({ ...row, pipeline_id: v.pipelineId, stage_id: v.stageId }).select("id").single();
  if (res.error?.code === "23505") {
    // Dedupe (RF-CRM-01): aponta o lead que já existe quando a pessoa pode vê-lo.
    let q = supabase.from("leads").select("id, name").limit(1);
    q = row.phone && res.error.message.includes("phone") ? q.eq("phone", row.phone) : q.ilike("email", row.email ?? "");
    const { data: dup } = await q.maybeSingle();
    const field = res.error.message.includes("phone") ? "phone" : "email";
    const msg = dup ? `Já existe o lead “${dup.name}” com este ${field === "phone" ? "telefone" : "e-mail"}.` : `Já existe um lead com este ${field === "phone" ? "telefone" : "e-mail"} (de outra pessoa do comercial).`;
    return fail("conflict", msg, { [field]: [msg] });
  }
  const { id } = must(res) as { id: string };
  refresh(id);
  return ok({ id }, v.id ? "Lead salvo." : "Lead cadastrado.");
});

export const deleteLead = defineAction({ schema: z.object({ id: z.uuid() }), permission: "crm.leads.manage" }, async ({ id }) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) return fail("business_rule", "Lead ganho, ligado a um cliente, não pode ser excluído.");
  refresh();
  return ok(null, "Lead excluído.");
});

export const moveLead = defineAction({ schema: moveLeadSchema, permission: "crm.leads.manage" }, async ({ id, stageId, reason }) => {
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_lead", { p_lead: id, p_stage: stageId, p_reason: reason || undefined });
  if (error) {
    if (error.code === "P0001") return fail("business_rule", error.message, error.message.includes("motivo") ? { reason: [error.message] } : undefined);
    throw error;
  }
  refresh(id);
  return ok(null);
});

export const addActivity = defineAction({ schema: activitySchema, permission: "crm.leads.manage" }, async ({ leadId, kind, body, dueAt }) => {
  const supabase = await createClient();
  must(await supabase.from("lead_activities").insert({ lead_id: leadId, kind, body, due_at: dueAt }).select("id").single());
  refresh(leadId);
  return ok(null, dueAt ? "Próxima ação agendada. O responsável recebe o lembrete na hora." : "Registrado no histórico.");
});

export const setActivityDone = defineAction({ schema: activityDoneSchema, permission: "crm.leads.manage" }, async ({ id, leadId, done }) => {
  const supabase = await createClient();
  must(await supabase.from("lead_activities").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id).select("id").single());
  refresh(leadId);
  return ok(null, done ? "Ação concluída." : "Ação reaberta.");
});

export const importLeads = defineAction({ schema: leadImportSchema, permission: "crm.leads.manage" }, async ({ fileName, pipelineId, rows }) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_leads", { p_file: fileName, p_pipeline: pipelineId, p_rows: rows });
  if (error) {
    if (error.code === "P0001" || error.code === "P0002") return fail("business_rule", error.message);
    throw error;
  }
  const r = data as { imported: number; duplicates: number };
  refresh();
  return ok(r, `${r.imported} lead(s) importado(s)${r.duplicates ? `; ${r.duplicates} já existiam e foram pulados` : ""}.`);
});

export const undoLeadImport = defineAction({ schema: z.object({ id: z.uuid() }), permission: "crm.leads.manage" }, async ({ id }) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("undo_lead_import", { p_import: id });
  if (error) {
    if (error.code === "P0002") return fail("not_found", error.message);
    throw error;
  }
  refresh();
  return ok(null, `Importação desfeita: ${data} lead(s) removido(s).`);
});

// --- Funis e etapas (crm.pipeline.configure) ---------------------------------------

export const savePipeline = defineAction({ schema: pipelineSchema, permission: "crm.pipeline.configure" }, async ({ id, name }) => {
  const supabase = await createClient();
  if (id) {
    must(await supabase.from("pipelines").update({ name }).eq("id", id).select("id").single());
    refresh();
    return ok({ id }, "Funil salvo.");
  }
  const p = must(await supabase.from("pipelines").insert({ name }).select("id").single()) as { id: string };
  must(
    await supabase
      .from("pipeline_stages")
      .insert([
        { pipeline_id: p.id, name: "Novo lead", position: 1, color: "#2563EB", kind: "aberta", sla_days: 2 },
        { pipeline_id: p.id, name: "Em conversa", position: 2, color: "#7C3AED", kind: "aberta", sla_days: 5 },
        { pipeline_id: p.id, name: "Ganho", position: 3, color: "#16A34A", kind: "ganho" },
        { pipeline_id: p.id, name: "Perdido", position: 4, color: "#DC2626", kind: "perdido" },
      ])
      .select("id"),
  );
  refresh();
  return ok({ id: p.id }, "Funil criado com as etapas básicas. Ajuste como quiser.");
});

export const deletePipeline = defineAction({ schema: z.object({ id: z.uuid() }), permission: "crm.pipeline.configure" }, async ({ id }) => {
  const supabase = await createClient();
  const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("pipeline_id", id);
  if (count) return fail("business_rule", `Este funil tem ${count} lead(s). Mova ou exclua os leads antes.`);
  const { data: p } = await supabase.from("pipelines").select("is_default").eq("id", id).single();
  if (p?.is_default) return fail("business_rule", "O funil principal não pode ser excluído.");
  must(await supabase.from("pipelines").delete().eq("id", id).select("id").single());
  refresh();
  return ok(null, "Funil excluído.");
});

export const saveStage = defineAction({ schema: stageSchema, permission: "crm.pipeline.configure" }, async ({ id, pipelineId, name, color, slaDays }) => {
  const supabase = await createClient();
  if (id) {
    must(await supabase.from("pipeline_stages").update({ name, color, sla_days: slaDays }).eq("id", id).select("id").single());
  } else {
    // Etapa nova entra antes de Ganho/Perdido.
    const stages = must(await supabase.from("pipeline_stages").select("id, position, kind").eq("pipeline_id", pipelineId).order("position")) as { id: string; position: number; kind: string }[];
    const open = stages.filter((s) => s.kind === "aberta");
    const pos = (open.at(-1)?.position ?? 0) + 1;
    for (const s of stages.filter((s) => s.position >= pos).reverse()) {
      must(await supabase.from("pipeline_stages").update({ position: s.position + 1 }).eq("id", s.id).select("id").single());
    }
    must(await supabase.from("pipeline_stages").insert({ pipeline_id: pipelineId, name, color, sla_days: slaDays, kind: "aberta", position: pos }).select("id").single());
  }
  refresh();
  return ok(null, id ? "Etapa salva." : "Etapa adicionada.");
});

export const deleteStage = defineAction({ schema: z.object({ id: z.uuid() }), permission: "crm.pipeline.configure" }, async ({ id }) => {
  const supabase = await createClient();
  const { data: s } = await supabase.from("pipeline_stages").select("kind").eq("id", id).single();
  if (s && s.kind !== "aberta") return fail("business_rule", "Ganho e Perdido fazem parte de todo funil e não podem ser excluídos.");
  const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage_id", id);
  if (count) return fail("business_rule", `Esta etapa tem ${count} lead(s). Mova-os para outra etapa antes de excluir.`);
  must(await supabase.from("pipeline_stages").delete().eq("id", id).select("id").single());
  refresh();
  return ok(null, "Etapa excluída.");
});

export const moveStage = defineAction({ schema: moveStageSchema, permission: "crm.pipeline.configure" }, async ({ id, pipelineId, direction }) => {
  const supabase = await createClient();
  const all = must(await supabase.from("pipeline_stages").select("id, position, kind").eq("pipeline_id", pipelineId).order("position")) as { id: string; position: number; kind: string }[];
  const open = all.filter((s) => s.kind === "aberta");
  const i = open.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= open.length) return ok(null);
  const [a, b] = [open[i], open[j]];
  must(await supabase.from("pipeline_stages").update({ position: b.position }).eq("id", a.id).select("id").single());
  must(await supabase.from("pipeline_stages").update({ position: a.position }).eq("id", b.id).select("id").single());
  refresh();
  return ok(null);
});
