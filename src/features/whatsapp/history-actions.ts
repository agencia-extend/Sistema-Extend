"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction } from "@/lib/actions";
import { fail, ok } from "@/domain/shared/result";
import type { ImportJob } from "@/domain/whatsapp/history";
import { createAdminClient } from "@/lib/supabase/admin";
import { runImportStep } from "@/lib/whatsapp/history";
import { getWhatsapp, wahaConn } from "@/lib/whatsapp/store";
import { WahaError, wahaSession, wahaStoreOn } from "@/lib/whatsapp/waha";
import { importSchema } from "./schemas";

// "Compilar conversas" (como no HubSystem): traz o histórico do aparelho para o Atendimento.
const PERM = ["inbox.manage", "integrations.manage"] as const;
const JOB_COLUMNS = "id, status, include_contacts, include_groups, pass, contacts_done, groups_done, skipped, messages_done, last_error";
/** Quanto cada chamada da tela trabalha. Ela chama de novo até terminar. */
const STEP_MS = 20_000;

async function latestJob(connectionId: string) {
  const { data } = await createAdminClient().from("wa_imports").select(JOB_COLUMNS).eq("connection_id", connectionId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data as ImportJob | null;
}

/** Se já dá para compilar (conectado e guardando o histórico) e como está a última compilação. */
export const getHistoryState = defineAction({ schema: z.object({}), permission: [...PERM] }, async (_, { user }) => {
  const c = await getWhatsapp(user.organizationId);
  if (!c) return fail("business_rule", "Conecte o WhatsApp primeiro.");
  try {
    const s = await wahaSession(wahaConn(c));
    return ok({ connected: s?.status === "WORKING", storeOn: wahaStoreOn(s), job: await latestJob(c.id) });
  } catch (e) {
    return fail("network", e instanceof WahaError ? e.message : "Não foi possível falar com o servidor do WhatsApp.");
  }
});

export const startHistoryImport = defineAction({ schema: importSchema, permission: [...PERM] }, async ({ contacts, groups }, { user }) => {
  const c = await getWhatsapp(user.organizationId);
  if (!c || c.status !== "WORKING") return fail("business_rule", "Conecte o WhatsApp antes de compilar as conversas.");
  const db = createAdminClient();
  const { data: created, error } = await db
    .from("wa_imports")
    .insert({ organization_id: user.organizationId, connection_id: c.id, include_contacts: contacts, include_groups: groups, created_by: user.id })
    .select(JOB_COLUMNS)
    .maybeSingle();
  // Já existe uma em andamento: acompanha a que está rodando em vez de começar outra.
  if (error && error.code !== "23505") return fail("network", "Não foi possível começar a compilação.");
  const job = (created as ImportJob | null) ?? (await latestJob(c.id));
  return job ? ok(job) : fail("network", "Não foi possível começar a compilação.");
});

export const continueHistoryImport = defineAction({ schema: z.object({ jobId: z.uuid() }), permission: [...PERM] }, async ({ jobId }, { user }) => {
  const db = createAdminClient();
  const { data: job } = await db.from("wa_imports").select("organization_id").eq("id", jobId).maybeSingle();
  if (!job || job.organization_id !== user.organizationId) return fail("not_found", "Compilação não encontrada.");
  await runImportStep(jobId, STEP_MS);
  revalidatePath("/atendimento");
  const { data } = await db.from("wa_imports").select(JOB_COLUMNS).eq("id", jobId).single();
  return ok(data as ImportJob);
});

export const cancelHistoryImport = defineAction({ schema: z.object({ jobId: z.uuid() }), permission: [...PERM] }, async ({ jobId }, { user }) => {
  const { data } = await createAdminClient()
    .from("wa_imports")
    .update({ status: "cancelada", finished_at: new Date().toISOString(), lease_until: null })
    .eq("id", jobId)
    .eq("organization_id", user.organizationId)
    .in("status", ["importando", "aguardando"])
    .select("id");
  if (!data?.length) return fail("not_found", "Esta compilação já tinha terminado.");
  revalidatePath("/atendimento");
  return ok(null, "Compilação interrompida. O que já entrou continua no Atendimento.");
});
