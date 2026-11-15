"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { fail, ok } from "@/domain/shared/result";
import { createClient } from "@/lib/supabase/server";
import { feedbackSchema, reportSchema } from "./schemas";

const SENDERS = ["reports.manage", "content.publish"] as const;

function refresh(clientId: string) {
  revalidatePath(`/clientes/${clientId}/relatorios`);
  revalidatePath("/relatorios");
}

/** Registrar ou corrigir o envio do relatório da semana (a RLS confere a área: tráfego ou conteúdo). */
export const saveReport = defineAction({ schema: reportSchema, permission: [...SENDERS] }, async ({ id, clientId, area, sentOn, link, notes }) => {
  const supabase = await createClient();
  const row = { sent_on: sentOn, link: link || null, notes: notes || null };
  if (id) {
    const { data } = await supabase.from("client_reports").update(row).eq("id", id).select("id");
    if (!data?.length) return fail("forbidden", "Você não pode corrigir este relatório.");
  } else must(await supabase.from("client_reports").insert({ ...row, client_id: clientId, area }).select("id").single());
  refresh(clientId);
  return ok(null, id ? "Envio corrigido." : "Envio do relatório registrado.");
});

/** Retorno do cliente: quem envia a área ou o responsável pela comunicação (RLS). */
export const saveFeedback = defineAction({ schema: feedbackSchema }, async ({ id, clientId, feedback, feedbackNote }) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_reports")
    .update({ feedback, feedback_note: feedbackNote || null })
    .eq("id", id)
    .select("call_task_id")
    .maybeSingle();
  if (!data) return fail("forbidden", "Você não pode registrar o retorno deste relatório.");
  refresh(clientId);
  revalidatePath(`/clientes/${clientId}/historico`);
  return ok(null, feedback === "sem_retorno" && data.call_task_id ? "Retorno registrado. A demanda de ligação foi criada." : "Retorno registrado.");
});

export const deleteReport = defineAction({ schema: z.object({ id: z.uuid(), clientId: z.uuid() }), permission: [...SENDERS] }, async ({ id, clientId }) => {
  const supabase = await createClient();
  const { data } = await supabase.from("client_reports").delete().eq("id", id).select("id");
  if (!data?.length) return fail("forbidden", "Só dá para apagar um envio sem retorno registrado, da sua área.");
  refresh(clientId);
  return ok(null, "Envio apagado.");
});
