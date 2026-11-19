"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ok } from "@/domain/shared/result";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { cadenceSchema, enrollSchema, optOutSchema } from "./schemas";

// Cadências de follow-up (RF-CRM-06). O banco confere quem pode o quê.

export const saveCadence = defineAction({ schema: cadenceSchema, permission: "crm.pipeline.configure" }, async ({ id, name, description, steps }) => {
  const supabase = await createClient();
  must(await supabase.rpc("save_cadence", { p_id: id ?? (null as unknown as string), p_name: name, p_description: description, p_steps: steps }));
  revalidatePath("/configuracoes/cadencias");
  return ok(null, id ? "Cadência salva. Vale para as próximas que começarem." : "Cadência criada.");
});

export const setCadenceActive = defineAction({ schema: z.object({ id: z.uuid(), active: z.boolean() }), permission: "crm.pipeline.configure" }, async ({ id, active }) => {
  const supabase = await createClient();
  must(await supabase.rpc("set_cadence_active", { p_id: id, p_active: active }));
  revalidatePath("/configuracoes/cadencias");
  return ok(null, active ? "Cadência ativada." : "Cadência desativada: não aparece mais para iniciar.");
});

export const enrollLead = defineAction({ schema: enrollSchema, permission: "crm.leads.manage" }, async ({ leadId, templateId, start }) => {
  const supabase = await createClient();
  must(await supabase.rpc("enroll_lead", { p_lead: leadId, p_template: templateId, p_start: start }));
  revalidatePath(`/comercial/leads/${leadId}`);
  return ok(null, "Cadência iniciada. Os passos entraram nas próximas ações.");
});

export const changeCadence = defineAction(
  { schema: z.object({ id: z.uuid(), leadId: z.uuid(), action: z.enum(["pausar", "retomar", "cancelar"]) }), permission: "crm.leads.manage" },
  async ({ id, leadId, action }) => {
    const supabase = await createClient();
    must(await supabase.rpc("change_cadence", { p_id: id, p_action: action }));
    revalidatePath(`/comercial/leads/${leadId}`);
    return ok(null, action === "pausar" ? "Cadência pausada." : action === "retomar" ? "Cadência retomada: os prazos andaram o tempo que ficou parada." : "Cadência cancelada.");
  },
);

export const setLeadOptOut = defineAction({ schema: optOutSchema, permission: "crm.leads.manage" }, async ({ leadId, out, note }) => {
  const supabase = await createClient();
  must(await supabase.rpc("set_lead_opt_out", { p_lead: leadId, p_out: out, p_note: note }));
  revalidatePath(`/comercial/leads/${leadId}`);
  return ok(null, out ? "Anotado: não recebe mais contato. A cadência foi encerrada." : "O lead volta a aceitar contato.");
});
