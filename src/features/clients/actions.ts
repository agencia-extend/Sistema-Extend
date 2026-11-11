"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import type { Json, TablesUpdate } from "@/lib/supabase/database.types";
import { fail, ok } from "@/domain/shared/result";
import {
  accountSchema,
  answersSchema,
  checklistItemSchema,
  clientDataSchema,
  clientServiceSchema,
  contactSchema,
  handoffSchema,
  idSchema,
  ideaSchema,
  importSchema,
  meetingSchema,
  memberSchema,
  newChecklistItemSchema,
  promiseSchema,
  statusSchema,
  taskStatusSchema,
} from "./schemas";

const base = (id: string) => `/clientes/${id}`;
const refresh = (id: string) => {
  revalidatePath("/clientes");
  revalidatePath(base(id), "layout");
};
const nil = (v: string | undefined | null) => (v ? v : null);

// --- Fechamento comercial ------------------------------------------------------

export const createHandoff = defineAction({ schema: handoffSchema, permission: "commercial.handoff.create" }, async (input) => {
  const supabase = await createClient();
  const id = must(await supabase.rpc("create_handoff", { p: input })) as string;
  revalidatePath("/clientes");
  revalidatePath("/inicio");
  return ok({ id }, "Fechamento registrado. A equipe de onboarding foi avisada.");
});

// --- Cadastro -----------------------------------------------------------------

export const updateClientData = defineAction({ schema: clientDataSchema }, async ({ id, ...d }) => {
  const supabase = await createClient();
  must(
    await supabase
      .from("clients")
      .update({
        name: d.name,
        legal_name: nil(d.legal_name),
        document: nil(d.document),
        segment: nil(d.segment),
        contract_start: nil(d.contract_start),
        contract_end: nil(d.contract_end),
        renewal_date: nil(d.renewal_date),
        media_budget_cents: d.media_budget_cents ?? null,
        monthly_fee_cents: d.monthly_fee_cents ?? null,
        payment_method: nil(d.payment_method),
        communication_channel: nil(d.communication_channel),
        notes: nil(d.notes),
      })
      .eq("id", id)
      .select("id")
      .single(),
  );
  refresh(id);
  return ok(null, "Dados do cliente salvos.");
});

export const setClientService = defineAction({ schema: clientServiceSchema }, async ({ clientId, serviceId, qty, priceCents }) => {
  const supabase = await createClient();
  must(await supabase.rpc("set_client_service", { p_client: clientId, p_service: serviceId, p_qty: qty as number, p_price_cents: priceCents ?? undefined }));
  refresh(clientId);
  return ok(null, qty === null ? "Serviço removido." : "Serviço atualizado.");
});

export const setClientStatus = defineAction({ schema: statusSchema }, async ({ clientId, status }) => {
  const supabase = await createClient();
  must(await supabase.rpc("set_client_status", { p_client: clientId, p_status: status }));
  refresh(clientId);
  return ok(null, "Status alterado.");
});

export const archiveClient = defineAction({ schema: z.object({ clientId: z.uuid() }) }, async ({ clientId }) => {
  const supabase = await createClient();
  must(await supabase.rpc("archive_client", { p_client: clientId }));
  revalidatePath("/clientes");
  return ok(null, "Cliente arquivado.");
});

export const addMember = defineAction({ schema: memberSchema }, async ({ clientId, sectorId, profileId }) => {
  const supabase = await createClient();
  const { error } = await supabase.from("client_members").insert({ client_id: clientId, sector_id: sectorId, profile_id: profileId });
  if (error?.code === "23505") return fail("conflict", "Esta pessoa já está marcada neste setor.");
  if (error) throw error;
  refresh(clientId);
  return ok(null, "Pessoa marcada. Ela já tem acesso ao cliente e foi avisada.");
});

export const removeMember = defineAction({ schema: memberSchema }, async ({ clientId, sectorId, profileId }) => {
  const supabase = await createClient();
  must(await supabase.from("client_members").delete().eq("client_id", clientId).eq("sector_id", sectorId).eq("profile_id", profileId));
  refresh(clientId);
  return ok(null, "Pessoa removida do cliente.");
});

export const saveAccount = defineAction({ schema: accountSchema }, async ({ id, clientId, kind, value, label }) => {
  const supabase = await createClient();
  const row = { client_id: clientId, kind, value, label: nil(label) };
  must(id ? await supabase.from("client_accounts").update(row).eq("id", id) : await supabase.from("client_accounts").insert(row));
  refresh(clientId);
  return ok(null, "Conta salva.");
});

export const deleteAccount = defineAction({ schema: z.object({ id: z.uuid(), clientId: z.uuid() }) }, async ({ id, clientId }) => {
  const supabase = await createClient();
  must(await supabase.from("client_accounts").delete().eq("id", id));
  refresh(clientId);
  return ok(null, "Conta removida.");
});

export const saveContact = defineAction({ schema: contactSchema }, async ({ id, clientId, ...c }) => {
  const supabase = await createClient();
  const row = { client_id: clientId, name: c.name, role: nil(c.role), phone: nil(c.phone), email: nil(c.email), is_primary: c.is_primary };
  must(id ? await supabase.from("client_contacts").update(row).eq("id", id) : await supabase.from("client_contacts").insert(row));
  refresh(clientId);
  return ok(null, "Contato salvo.");
});

export const deleteContact = defineAction({ schema: z.object({ id: z.uuid(), clientId: z.uuid() }) }, async ({ id, clientId }) => {
  const supabase = await createClient();
  must(await supabase.from("client_contacts").delete().eq("id", id));
  refresh(clientId);
  return ok(null, "Contato removido.");
});

// --- Promessas -----------------------------------------------------------------

export const savePromise = defineAction({ schema: promiseSchema }, async ({ id, clientId, description, due_at }) => {
  const supabase = await createClient();
  const row = { client_id: clientId, description, due_at: new Date(due_at).toISOString() };
  must(id ? await supabase.from("handoff_promises").update(row).eq("id", id) : await supabase.from("handoff_promises").insert(row));
  refresh(clientId);
  return ok(null, "Promessa salva.");
});

export const togglePromise = defineAction(
  { schema: z.object({ id: z.uuid(), clientId: z.uuid(), done: z.boolean() }) },
  async ({ id, clientId, done }, { user }) => {
    const supabase = await createClient();
    must(
      await supabase
        .from("handoff_promises")
        .update({ done_at: done ? new Date().toISOString() : null, done_by: done ? user.id : null })
        .eq("id", id)
        .select("id")
        .single(),
    );
    refresh(clientId);
    return ok(null, done ? "Promessa cumprida." : "Promessa reaberta.");
  },
);

// --- Onboarding ----------------------------------------------------------------

export const saveAnswers = defineAction({ schema: answersSchema }, async ({ clientId, answers }, { user }) => {
  const supabase = await createClient();
  const cur = must(await supabase.from("client_onboarding").select("answers, completed_at").eq("client_id", clientId).single()) as {
    answers: Record<string, unknown>;
    completed_at: string | null;
  };
  if (cur.completed_at) return fail("business_rule", "Este onboarding já foi concluído. A ficha não pode mais ser alterada.");
  must(
    await supabase
      .from("client_onboarding")
      .update({ answers: { ...cur.answers, ...answers } as { [key: string]: Json }, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq("client_id", clientId)
      .select("client_id")
      .single(),
  );
  revalidatePath(base(clientId), "layout");
  return ok({ savedAt: new Date().toISOString() });
});

export const updateChecklistItem = defineAction({ schema: checklistItemSchema }, async ({ id, done, assigneeId, dueAt }, { user }) => {
  const supabase = await createClient();
  const patch: TablesUpdate<"onboarding_checklist_items"> = {};
  if (done !== undefined) Object.assign(patch, { done_at: done ? new Date().toISOString() : null, done_by: done ? user.id : null });
  if (assigneeId !== undefined) patch.assignee_id = assigneeId;
  if (dueAt !== undefined) patch.due_at = dueAt ? new Date(dueAt).toISOString() : null;
  const row = must(await supabase.from("onboarding_checklist_items").update(patch).eq("id", id).select("client_id").single()) as { client_id: string };
  refresh(row.client_id);
  return ok(null);
});

export const addChecklistItem = defineAction({ schema: newChecklistItemSchema }, async ({ clientId, title }) => {
  const supabase = await createClient();
  must(await supabase.from("onboarding_checklist_items").insert({ client_id: clientId, title, position: 100 }));
  refresh(clientId);
  return ok(null, "Item adicionado ao checklist.");
});

export const completeOnboarding = defineAction({ schema: z.object({ clientId: z.uuid() }) }, async ({ clientId }) => {
  const supabase = await createClient();
  const slots = must(await supabase.rpc("complete_onboarding", { p_client: clientId })) as number;
  refresh(clientId);
  revalidatePath("/inicio");
  return ok({ slots }, slots ? `Onboarding concluído. ${slots} demanda(s) do mês criada(s).` : "Onboarding concluído. Cliente ativo.");
});

// --- Reuniões, ideias e arquivos -----------------------------------------------

export const saveMeeting = defineAction({ schema: meetingSchema }, async ({ id, clientId, ...m }, { user }) => {
  const supabase = await createClient();
  const row = {
    client_id: clientId,
    held_at: new Date(m.held_at).toISOString(),
    kind: m.kind,
    title: m.title,
    summary: nil(m.summary),
    link: nil(m.link),
    participant_ids: m.participant_ids,
  };
  const saved = must(
    id
      ? await supabase.from("client_meetings").update(row).eq("id", id).select("id").single()
      : await supabase.from("client_meetings").insert({ ...row, created_by: user.id }).select("id").single(),
  ) as { id: string };
  if (!id) {
    const { data: client } = await supabase.from("clients").select("name").eq("id", clientId).single();
    const others = m.participant_ids.filter((p) => p !== user.id);
    if (others.length && process.env.SUPABASE_SECRET_KEY) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const future = new Date(row.held_at) > new Date();
      await createAdminClient().rpc("notify_users", {
        p_users: others,
        p_kind: "assigned",
        p_title: `${future ? "Reunião agendada" : "Reunião registrada"}: ${client?.name ?? ""}`,
        p_body: `${m.title} · ${new Date(row.held_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
        p_href: `${base(clientId)}/reunioes`,
        p_dedupe_key: `reuniao:${saved.id}`,
        p_actor: user.id,
      });
    }
  }
  refresh(clientId);
  return ok({ id: saved.id }, id ? "Reunião atualizada." : "Reunião registrada.");
});

export const deleteMeeting = defineAction({ schema: z.object({ id: z.uuid(), clientId: z.uuid() }) }, async ({ id, clientId }) => {
  const supabase = await createClient();
  must(await supabase.from("client_meetings").delete().eq("id", id));
  refresh(clientId);
  return ok(null, "Reunião excluída.");
});

export const saveIdea = defineAction({ schema: ideaSchema }, async ({ id, clientId, ...i }, { user }) => {
  const supabase = await createClient();
  const row = { client_id: clientId, title: i.title, body: nil(i.body), link: nil(i.link), tags: i.tags };
  must(id ? await supabase.from("client_ideas").update(row).eq("id", id) : await supabase.from("client_ideas").insert({ ...row, created_by: user.id }));
  refresh(clientId);
  return ok(null, "Ideia salva.");
});

export const deleteIdea = defineAction({ schema: z.object({ id: z.uuid(), clientId: z.uuid() }) }, async ({ id, clientId }) => {
  const supabase = await createClient();
  must(await supabase.from("client_ideas").delete().eq("id", id));
  refresh(clientId);
  return ok(null, "Ideia excluída.");
});

/** Ideia vira demanda (RF-CLI-09). */
export const ideaToTask = defineAction({ schema: idSchema, permission: "tasks.manage" }, async ({ id }, { user }) => {
  const supabase = await createClient();
  const idea = must(await supabase.from("client_ideas").select("id, client_id, title, body, link, converted_task_id").eq("id", id).single()) as {
    id: string;
    client_id: string;
    title: string;
    body: string | null;
    link: string | null;
    converted_task_id: string | null;
  };
  if (idea.converted_task_id) return fail("business_rule", "Esta ideia já virou demanda.");
  const task = must(
    await supabase
      .from("tasks")
      .insert({
        organization_id: user.organizationId,
        client_id: idea.client_id,
        type: "conteudo",
        title: idea.title,
        description: [idea.body, idea.link].filter(Boolean).join("\n\n") || null,
        created_by: user.id,
      })
      .select("id")
      .single(),
  ) as { id: string };
  must(await supabase.from("client_ideas").update({ converted_task_id: task.id }).eq("id", id));
  refresh(idea.client_id);
  return ok(null, "Ideia transformada em demanda.");
});

const MAX_FILE = 10 * 1024 * 1024;
const safeName = (n: string) =>
  n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .slice(-120);

/** Upload de anexo leve para o Storage privado (vídeos não ficam no Supabase). */
export async function uploadClientFile(form: FormData) {
  return uploadAction({
    clientId: form.get("clientId"),
    category: form.get("category") ?? "geral",
    meetingId: form.get("meetingId") || undefined,
    file: form.get("file"),
  });
}

const uploadAction = defineAction(
  {
    schema: z.object({
      clientId: z.uuid(),
      category: z.enum(["geral", "fechamento", "reuniao", "identidade", "contrato", "referencia"]),
      meetingId: z.uuid().optional(),
      file: z.instanceof(File, { message: "Escolha um arquivo." }),
    }),
  },
  async ({ clientId, category, meetingId, file }, { user }) => {
    if (file.size === 0) return fail("validation", "O arquivo está vazio.");
    if (file.size > MAX_FILE) return fail("validation", "Arquivo maior que 10 MB. Vídeos e arquivos grandes devem ficar no Drive do cliente.");
    if (/^video\//.test(file.type)) return fail("validation", "Vídeos não são guardados no sistema. Envie pelo Drive e cole o link.");
    const supabase = await createClient();
    const path = `clientes/${clientId}/${randomUUID()}-${safeName(file.name)}`;
    const up = await supabase.storage.from("anexos").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (up.error) return fail("forbidden", "Não foi possível enviar o arquivo. Verifique se você tem acesso a este cliente.");
    const { error } = await supabase.from("client_files").insert({
      client_id: clientId,
      storage_path: path,
      name: file.name.slice(0, 200),
      mime_type: file.type || null,
      size_bytes: file.size,
      category,
      meeting_id: meetingId ?? null,
      uploaded_by: user.id,
    });
    if (error) {
      await supabase.storage.from("anexos").remove([path]);
      throw error;
    }
    refresh(clientId);
    return ok(null, "Arquivo enviado.");
  },
);

export const deleteFile = defineAction({ schema: z.object({ id: z.uuid(), clientId: z.uuid() }) }, async ({ id, clientId }) => {
  const supabase = await createClient();
  const f = must(await supabase.from("client_files").select("storage_path").eq("id", id).single()) as { storage_path: string };
  must(await supabase.from("client_files").delete().eq("id", id).select("id").single());
  await supabase.storage.from("anexos").remove([f.storage_path]);
  refresh(clientId);
  return ok(null, "Arquivo excluído.");
});

export const fileUrl = defineAction({ schema: z.object({ path: z.string().regex(/^clientes\/[0-9a-f-]{36}\//) }) }, async ({ path }) => {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("anexos").createSignedUrl(path, 300);
  if (error || !data) return fail("forbidden", "Você não tem acesso a este arquivo.");
  return ok({ url: data.signedUrl });
});

// --- Demanda do mês ------------------------------------------------------------

export const setTaskStatus = defineAction({ schema: taskStatusSchema }, async ({ id, status }) => {
  const supabase = await createClient();
  const t = must(
    await supabase
      .from("tasks")
      .update({ status, completed_at: status === "concluido" ? new Date().toISOString() : null })
      .eq("id", id)
      .select("client_id")
      .single(),
  ) as { client_id: string | null };
  if (t.client_id) refresh(t.client_id);
  return ok(null, "Status da demanda atualizado.");
});

// --- Importação ------------------------------------------------------------------

export const importClients = defineAction({ schema: importSchema, permission: "clients.import" }, async ({ fileName, mode, rows }) => {
  const supabase = await createClient();
  const id = must(await supabase.rpc("import_clients", { p_file: fileName, p_rows: rows, p_mode: mode })) as string;
  revalidatePath("/clientes");
  return ok({ id }, `${rows.length} cliente(s) importado(s).`);
});

export const undoImport = defineAction({ schema: idSchema, permission: "clients.import" }, async ({ id }) => {
  const supabase = await createClient();
  const n = must(await supabase.rpc("undo_import", { p_import: id })) as number;
  revalidatePath("/clientes");
  revalidatePath("/clientes/importar");
  return ok(null, `Importação desfeita: ${n} cliente(s) removido(s).`);
});
