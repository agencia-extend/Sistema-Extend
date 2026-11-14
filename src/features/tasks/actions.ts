"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { fail, ok } from "@/domain/shared/result";
import { findMentions } from "@/domain/tasks";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { boardSchema, columnSchema, commentSchema, createTaskSchema, eventSchema, linkSchema, moveSchema, stepSchema, tagSchema, updateTaskSchema } from "./schemas";

const uuid = z.uuid();
const touch = (id?: string | null, clientId?: string | null) => {
  revalidatePath("/tarefas");
  if (id) revalidatePath(`/tarefas/${id}`);
  if (clientId) revalidatePath(`/clientes/${clientId}`, "layout");
  revalidatePath("/setores", "layout");
  revalidatePath("/quadros", "layout");
};
const iso = (v?: string | null) => (v ? new Date(v).toISOString() : null);

// --- Cards -----------------------------------------------------------------------

export const createTask = defineAction({ schema: createTaskSchema, permission: "tasks.manage" }, async (t, { user }) => {
  const supabase = await createClient();
  const row = must(
    await supabase
      .from("tasks")
      .insert({
        organization_id: user.organizationId,
        title: t.title,
        client_id: t.clientId ?? null,
        type: t.type,
        assignee_id: t.assigneeId ?? null,
        due_at: iso(t.dueAt),
        description: t.description || null,
        priority: t.priority,
        board_id: t.boardId ?? null,
        board_column_id: t.columnId ?? null,
        created_by: user.id,
        repeat_unit: t.repeat?.unit ?? null,
        repeat_every: t.repeat?.every ?? null,
        repeat_owner_id: t.repeat ? (t.assigneeId ?? null) : null,
      })
      .select("id")
      .single(),
  ) as { id: string };
  touch(row.id, t.clientId);
  return ok({ id: row.id }, "Demanda criada.");
});

export const updateTask = defineAction({ schema: updateTaskSchema }, async ({ id, ...p }) => {
  const supabase = await createClient();
  const patch: TablesUpdate<"tasks"> = {};
  if (p.title !== undefined) patch.title = p.title;
  if (p.description !== undefined) patch.description = p.description || null;
  if (p.priority !== undefined) patch.priority = p.priority;
  if (p.dueAt !== undefined) patch.due_at = iso(p.dueAt);
  if (p.assigneeId !== undefined) patch.assignee_id = p.assigneeId;
  if (p.blockedBy !== undefined) {
    if (p.blockedBy === id) return fail("validation", "Uma demanda não pode esperar por ela mesma.");
    patch.blocked_by_task_id = p.blockedBy;
  }
  if (p.waitingNote !== undefined) patch.waiting_note = p.waitingNote || null;
  if (p.repeat !== undefined) {
    patch.repeat_unit = p.repeat?.unit ?? null;
    patch.repeat_every = p.repeat?.every ?? null;
    if (p.repeat) {
      // A série fica com quem está responsável agora.
      const { data: cur } = await supabase.from("tasks").select("assignee_id").eq("id", id).single();
      patch.repeat_owner_id = cur?.assignee_id ?? null;
    }
  }
  const row = must(await supabase.from("tasks").update(patch).eq("id", id).select("client_id").single()) as { client_id: string | null };
  touch(id, row.client_id);
  return ok(null, "Demanda atualizada.");
});

export const moveTask = defineAction({ schema: moveSchema, permission: "tasks.manage" }, async ({ id, stepId, columnId, position }) => {
  const supabase = await createClient();
  must(await supabase.rpc("move_task", { p_task: id, p_step: stepId as string, p_column: columnId as string, p_position: position as number }));
  touch(id);
  return ok(null);
});

export const deleteTask = defineAction({ schema: z.object({ id: uuid }), permission: "tasks.manage" }, async ({ id }) => {
  const supabase = await createClient();
  const row = must(await supabase.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("client_id").single()) as { client_id: string | null };
  touch(id, row.client_id);
  return ok(null, "Demanda excluída.");
});

// --- Etiquetas, participantes, checklist --------------------------------------------

export const createTag = defineAction({ schema: tagSchema, permission: "tasks.manage" }, async ({ name, color }, { user }) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tags").insert({ organization_id: user.organizationId, name, color }).select("id, name, color").single();
  if (error?.code === "23505") return fail("conflict", "Já existe uma etiqueta com esse nome.");
  if (error) throw error;
  return ok(data);
});

export const setTaskTags = defineAction({ schema: z.object({ id: uuid, tagIds: z.array(uuid).max(20) }) }, async ({ id, tagIds }) => {
  const supabase = await createClient();
  must(await supabase.from("task_tags").delete().eq("task_id", id));
  if (tagIds.length) must(await supabase.from("task_tags").insert(tagIds.map((tag_id) => ({ task_id: id, tag_id }))));
  touch(id);
  return ok(null);
});

export const setParticipants = defineAction({ schema: z.object({ id: uuid, profileIds: z.array(uuid).max(30) }) }, async ({ id, profileIds }) => {
  const supabase = await createClient();
  must(await supabase.from("task_participants").delete().eq("task_id", id));
  if (profileIds.length) must(await supabase.from("task_participants").insert(profileIds.map((profile_id) => ({ task_id: id, profile_id }))));
  touch(id);
  return ok(null, "Participantes atualizados.");
});

export const addChecklist = defineAction({ schema: z.object({ taskId: uuid, title: z.string().trim().min(1).max(200) }) }, async ({ taskId, title }) => {
  const supabase = await createClient();
  must(await supabase.from("task_checklist_items").insert({ task_id: taskId, title, position: Date.now() % 2_000_000_000 }));
  touch(taskId);
  return ok(null);
});

export const toggleChecklist = defineAction({ schema: z.object({ id: uuid, taskId: uuid, done: z.boolean() }) }, async ({ id, taskId, done }, { user }) => {
  const supabase = await createClient();
  must(await supabase.from("task_checklist_items").update({ done_at: done ? new Date().toISOString() : null, done_by: done ? user.id : null }).eq("id", id));
  touch(taskId);
  return ok(null);
});

export const deleteChecklist = defineAction({ schema: z.object({ id: uuid, taskId: uuid }) }, async ({ id, taskId }) => {
  const supabase = await createClient();
  must(await supabase.from("task_checklist_items").delete().eq("id", id));
  touch(taskId);
  return ok(null);
});

// --- Comentários com @menção -------------------------------------------------------

export const addComment = defineAction({ schema: commentSchema }, async ({ taskId, body }, { user }) => {
  const supabase = await createClient();
  const { data: team } = await supabase.from("profiles").select("id, full_name").eq("is_active", true).is("portal_client_id", null);
  const mentions = findMentions(body, (team ?? []).map((p) => ({ id: p.id, name: p.full_name }))).filter((id) => id !== user.id);
  must(await supabase.from("task_comments").insert({ task_id: taskId, author_id: user.id, body, mentions }));
  touch(taskId);
  return ok(null, mentions.length ? `Comentário enviado. ${mentions.length} pessoa(s) mencionada(s) avisada(s).` : "Comentário enviado.");
});

export const deleteComment = defineAction({ schema: z.object({ id: uuid, taskId: uuid }) }, async ({ id, taskId }) => {
  const supabase = await createClient();
  must(await supabase.from("task_comments").delete().eq("id", id));
  touch(taskId);
  return ok(null);
});

// --- Anexos -------------------------------------------------------------------------

const MAX = 10 * 1024 * 1024;
const safe = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-120);

const uploadAction = defineAction({ schema: z.object({ taskId: uuid, file: z.instanceof(File, { message: "Escolha um arquivo." }) }) }, async ({ taskId, file }, { user }) => {
  if (!file.size) return fail("validation", "O arquivo está vazio.");
  if (file.size > MAX) return fail("validation", "Arquivo maior que 10 MB. Envie pelo Drive e anexe o link.");
  if (/^video\//.test(file.type)) return fail("validation", "Vídeos ficam no Drive. Envie lá e use “Anexar link”.");
  const supabase = await createClient();
  const path = `tarefas/${taskId}/${randomUUID()}-${safe(file.name)}`;
  const up = await supabase.storage.from("anexos").upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (up.error) return fail("forbidden", "Não foi possível enviar o arquivo para esta demanda.");
  const { error } = await supabase.from("task_attachments").insert({ task_id: taskId, kind: "arquivo", name: file.name.slice(0, 200), storage_path: path, mime_type: file.type || null, size_bytes: file.size, uploaded_by: user.id });
  if (error) {
    await supabase.storage.from("anexos").remove([path]);
    throw error;
  }
  touch(taskId);
  return ok(null, "Arquivo anexado.");
});

export async function uploadTaskFile(form: FormData) {
  return uploadAction({ taskId: form.get("taskId"), file: form.get("file") });
}

export const addLink = defineAction({ schema: linkSchema }, async ({ taskId, name, url }, { user }) => {
  const supabase = await createClient();
  must(await supabase.from("task_attachments").insert({ task_id: taskId, kind: "link", name, url, uploaded_by: user.id }));
  touch(taskId);
  return ok(null, "Link anexado.");
});

export const deleteAttachment = defineAction({ schema: z.object({ id: uuid, taskId: uuid }) }, async ({ id, taskId }) => {
  const supabase = await createClient();
  const a = must(await supabase.from("task_attachments").select("storage_path").eq("id", id).single()) as { storage_path: string | null };
  must(await supabase.from("task_attachments").delete().eq("id", id).select("id").single());
  if (a.storage_path) await supabase.storage.from("anexos").remove([a.storage_path]);
  touch(taskId);
  return ok(null, "Anexo removido.");
});

export const taskFileUrl = defineAction({ schema: z.object({ path: z.string().regex(/^tarefas\/[0-9a-f-]{36}\//) }) }, async ({ path }) => {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("anexos").createSignedUrl(path, 600);
  if (error || !data) return fail("forbidden", "Você não tem acesso a este arquivo.");
  return ok({ url: data.signedUrl });
});

// --- Tempo --------------------------------------------------------------------------

export const startTimer = defineAction({ schema: z.object({ taskId: uuid }) }, async ({ taskId }) => {
  const supabase = await createClient();
  must(await supabase.rpc("start_timer", { p_task: taskId }));
  touch(taskId);
  revalidatePath("/", "layout");
  return ok(null, "Cronômetro iniciado.");
});

export const stopTimer = defineAction({ schema: z.object({ taskId: uuid.optional() }) }, async ({ taskId }) => {
  const supabase = await createClient();
  must(await supabase.rpc("stop_timer"));
  touch(taskId);
  revalidatePath("/", "layout");
  return ok(null, "Tempo registrado.");
});

// --- Responsável padrão por etapa no cliente -------------------------------------

export const setStepDefault = defineAction(
  { schema: z.object({ clientId: uuid, stepId: uuid, profileId: uuid.nullable() }) },
  async ({ clientId, stepId, profileId }) => {
    const supabase = await createClient();
    if (profileId) must(await supabase.from("client_step_defaults").upsert({ client_id: clientId, step_id: stepId, profile_id: profileId }));
    else must(await supabase.from("client_step_defaults").delete().eq("client_id", clientId).eq("step_id", stepId));
    revalidatePath(`/clientes/${clientId}`, "layout");
    return ok(null, "Responsável da etapa salvo.");
  },
);

// --- Quadros livres -----------------------------------------------------------------

export const saveBoard = defineAction({ schema: boardSchema, permission: "tasks.boards.configure" }, async ({ id, name, sectorId }, { user }) => {
  const supabase = await createClient();
  if (id) {
    must(await supabase.from("boards").update({ name, sector_id: sectorId ?? null }).eq("id", id).select("id").single());
    touch();
    return ok({ id }, "Quadro salvo.");
  }
  const b = must(await supabase.from("boards").insert({ organization_id: user.organizationId, name, sector_id: sectorId ?? null, created_by: user.id }).select("id").single()) as { id: string };
  must(
    await supabase.from("board_columns").insert([
      { board_id: b.id, name: "A fazer", position: 1, color: "#64748B" },
      { board_id: b.id, name: "Fazendo", position: 2, color: "#1D8AE6" },
      { board_id: b.id, name: "Feito", position: 3, color: "#22C55E", is_done: true },
    ]),
  );
  touch();
  return ok({ id: b.id }, "Quadro criado com as colunas A fazer, Fazendo e Feito.");
});

export const archiveBoard = defineAction({ schema: z.object({ id: uuid, archived: z.boolean() }), permission: "tasks.boards.configure" }, async ({ id, archived }) => {
  const supabase = await createClient();
  must(await supabase.from("boards").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id).select("id").single());
  touch();
  return ok(null, archived ? "Quadro arquivado." : "Quadro restaurado.");
});

export const saveColumn = defineAction({ schema: columnSchema, permission: "tasks.boards.configure" }, async ({ id, boardId, name, color, isDone }) => {
  const supabase = await createClient();
  if (id) must(await supabase.from("board_columns").update({ name, color, is_done: isDone }).eq("id", id).select("id").single());
  else {
    const { count } = await supabase.from("board_columns").select("id", { count: "exact", head: true }).eq("board_id", boardId);
    must(await supabase.from("board_columns").insert({ board_id: boardId, name, color, is_done: isDone, position: (count ?? 0) + 1 }));
  }
  touch();
  return ok(null, "Coluna salva.");
});

export const deleteColumn = defineAction({ schema: z.object({ id: uuid }), permission: "tasks.boards.configure" }, async ({ id }) => {
  const supabase = await createClient();
  const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("board_column_id", id).is("deleted_at", null);
  if (count) return fail("business_rule", "Mova os cards desta coluna antes de excluí-la.");
  must(await supabase.from("board_columns").delete().eq("id", id));
  touch();
  return ok(null, "Coluna excluída.");
});

// --- Fluxos -------------------------------------------------------------------------

export const saveStep = defineAction({ schema: stepSchema, permission: "tasks.boards.configure" }, async ({ id, workflowId, name, sectorId, status, waitsClient, color }) => {
  const supabase = await createClient();
  const row = { name, sector_id: sectorId, status, waits_client: waitsClient, color };
  if (id) must(await supabase.from("workflow_steps").update(row).eq("id", id).select("id").single());
  else {
    const { data: last } = await supabase.from("workflow_steps").select("position").eq("workflow_id", workflowId).order("position", { ascending: false }).limit(1).maybeSingle();
    must(await supabase.from("workflow_steps").insert({ ...row, workflow_id: workflowId, position: (last?.position ?? 0) + 1 }));
  }
  revalidatePath("/configuracoes/fluxos");
  return ok(null, "Etapa salva.");
});

export const moveStep = defineAction({ schema: z.object({ id: uuid, direction: z.enum(["up", "down"]) }), permission: "tasks.boards.configure" }, async ({ id, direction }) => {
  const supabase = await createClient();
  const s = must(await supabase.from("workflow_steps").select("id, workflow_id, position").eq("id", id).single()) as { id: string; workflow_id: string; position: number };
  const q = supabase.from("workflow_steps").select("id, position").eq("workflow_id", s.workflow_id).is("archived_at", null);
  const { data: other } = await (direction === "up" ? q.lt("position", s.position).order("position", { ascending: false }) : q.gt("position", s.position).order("position")).limit(1).maybeSingle();
  if (!other) return ok(null);
  must(await supabase.from("workflow_steps").update({ position: other.position }).eq("id", s.id));
  must(await supabase.from("workflow_steps").update({ position: s.position }).eq("id", other.id));
  revalidatePath("/configuracoes/fluxos");
  return ok(null);
});

export const archiveStep = defineAction({ schema: z.object({ id: uuid }), permission: "tasks.boards.configure" }, async ({ id }) => {
  const supabase = await createClient();
  const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("workflow_step_id", id).is("deleted_at", null).not("status", "in", "(concluido,cancelado)");
  if (count) return fail("business_rule", `Há ${count} demanda(s) abertas nesta etapa. Mova-as antes de remover a etapa.`);
  must(await supabase.from("workflow_steps").update({ archived_at: new Date().toISOString() }).eq("id", id));
  revalidatePath("/configuracoes/fluxos");
  return ok(null, "Etapa removida do fluxo.");
});

// --- Agenda -------------------------------------------------------------------------

export const saveEvent = defineAction({ schema: eventSchema, permission: "calendar.manage" }, async (e, { user }) => {
  const supabase = await createClient();
  const row = {
    title: e.title,
    kind: e.kind,
    sector_id: e.sectorId ?? null,
    client_id: e.clientId ?? null,
    task_id: e.taskId ?? null,
    starts_at: new Date(e.startsAt).toISOString(),
    ends_at: new Date(e.endsAt).toISOString(),
    location: e.location || null,
    link: e.link || null,
    notes: e.notes || null,
  };
  let id = e.id;
  if (id) must(await supabase.from("calendar_events").update(row).eq("id", id).select("id").single());
  else id = (must(await supabase.from("calendar_events").insert({ ...row, organization_id: user.organizationId, created_by: user.id }).select("id").single()) as { id: string }).id;
  const { data: cur } = await supabase.from("calendar_attendees").select("profile_id").eq("event_id", id);
  const have = new Set((cur ?? []).map((a) => a.profile_id));
  const want = new Set(e.attendeeIds);
  const remove = [...have].filter((p) => !want.has(p));
  const add = [...want].filter((p) => !have.has(p));
  if (remove.length) must(await supabase.from("calendar_attendees").delete().eq("event_id", id).in("profile_id", remove));
  if (add.length) must(await supabase.from("calendar_attendees").insert(add.map((profile_id) => ({ event_id: id!, profile_id }))));
  revalidatePath("/agenda");
  if (e.taskId) touch(e.taskId, e.clientId);
  return ok({ id }, e.id ? "Evento atualizado." : "Evento criado. Os participantes foram avisados.");
});

export const deleteEvent = defineAction({ schema: z.object({ id: uuid }) }, async ({ id }) => {
  const supabase = await createClient();
  must(await supabase.from("calendar_events").delete().eq("id", id).select("id").single());
  revalidatePath("/agenda");
  return ok(null, "Evento excluído.");
});
