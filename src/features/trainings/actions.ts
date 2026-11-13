"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { fail, ok } from "@/domain/shared/result";
import { assignSchema, doneSchema, idSchema, lessonRefSchema, lessonSchema, moveLessonSchema, trainingSchema } from "./schemas";

const LIST = "/treinamentos";
const page = (id: string) => `/treinamentos/${id}`;
const BUCKET = "treinamentos";

// --- Treinamento --------------------------------------------------------------------

export const saveTraining = defineAction({ schema: trainingSchema, permission: "trainings.manage" }, async (t, { user }) => {
  const supabase = await createClient();
  const row = { title: t.title, summary: t.summary || null, category: t.category, is_published: t.isPublished };
  let id = t.id;
  if (id) must(await supabase.from("trainings").update(row).eq("id", id).select("id").single());
  else id = (must(await supabase.from("trainings").insert({ ...row, organization_id: user.organizationId, created_by: user.id, position: 1000 }).select("id").single()) as { id: string }).id;
  revalidatePath(LIST);
  revalidatePath(page(id));
  return ok({ id }, t.id ? "Treinamento salvo." : t.isPublished ? "Treinamento criado. Agora adicione as aulas." : "Rascunho criado. Adicione as aulas e publique quando estiver pronto.");
});

export const deleteTraining = defineAction({ schema: idSchema, permission: "trainings.manage" }, async ({ id }) => {
  const supabase = await createClient();
  const { data: files } = await supabase.from("training_lessons").select("file_path").eq("training_id", id).not("file_path", "is", null);
  must(await supabase.from("trainings").delete().eq("id", id).select("id").single());
  const paths = (files ?? []).map((f) => f.file_path!).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  revalidatePath(LIST);
  return ok(null, "Treinamento excluído.");
});

// --- Aulas --------------------------------------------------------------------------

export const saveLesson = defineAction({ schema: lessonSchema, permission: "trainings.manage" }, async (l) => {
  const supabase = await createClient();
  const row = { title: l.title, body: l.body || null, video_url: l.videoUrl || null, duration_min: l.durationMin };
  let id = l.id;
  if (id) must(await supabase.from("training_lessons").update(row).eq("id", id).eq("training_id", l.trainingId).select("id").single());
  else {
    const { data: last } = await supabase.from("training_lessons").select("position").eq("training_id", l.trainingId).order("position", { ascending: false }).limit(1).maybeSingle();
    id = (must(await supabase.from("training_lessons").insert({ ...row, training_id: l.trainingId, position: (last?.position ?? 0) + 1 }).select("id").single()) as { id: string }).id;
  }
  revalidatePath(page(l.trainingId));
  revalidatePath(LIST);
  return ok({ id }, l.id ? "Aula salva." : "Aula adicionada.");
});

export const deleteLesson = defineAction({ schema: lessonRefSchema, permission: "trainings.manage" }, async ({ id, trainingId }) => {
  const supabase = await createClient();
  const l = must(await supabase.from("training_lessons").delete().eq("id", id).eq("training_id", trainingId).select("file_path").single()) as { file_path: string | null };
  if (l.file_path) await supabase.storage.from(BUCKET).remove([l.file_path]);
  revalidatePath(page(trainingId));
  revalidatePath(LIST);
  return ok(null, "Aula excluída.");
});

export const moveLesson = defineAction({ schema: moveLessonSchema, permission: "trainings.manage" }, async ({ id, trainingId, dir }) => {
  const supabase = await createClient();
  const rows = must(await supabase.from("training_lessons").select("id, position").eq("training_id", trainingId).order("position")) as { id: string; position: number }[];
  const i = rows.findIndex((r) => r.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return ok(null);
  const order = [...rows];
  [order[i], order[j]] = [order[j], order[i]];
  // Renumera tudo (1..n): resolve posições repetidas de aulas antigas.
  for (const [k, r] of order.entries()) {
    if (r.position !== k + 1) must(await supabase.from("training_lessons").update({ position: k + 1 }).eq("id", r.id).select("id").single());
  }
  revalidatePath(page(trainingId));
  return ok(null);
});

/** O arquivo sobe direto do navegador para o Storage (a RLS do bucket confere); aqui só registramos. */
export const attachLessonFile = defineAction(
  {
    schema: z.object({ lessonId: z.uuid(), trainingId: z.uuid(), path: z.string().max(400), name: z.string().trim().min(1).max(200) }),
    permission: "trainings.manage",
  },
  async ({ lessonId, trainingId, path, name }) => {
    if (!path.startsWith(`${trainingId}/`)) return fail("validation", "Arquivo fora deste treinamento.");
    const supabase = await createClient();
    const prev = must(await supabase.from("training_lessons").select("file_path").eq("id", lessonId).eq("training_id", trainingId).single()) as { file_path: string | null };
    must(await supabase.from("training_lessons").update({ file_path: path, file_name: name }).eq("id", lessonId).select("id").single());
    if (prev.file_path && prev.file_path !== path) await supabase.storage.from(BUCKET).remove([prev.file_path]);
    revalidatePath(page(trainingId));
    return ok(null, "Arquivo anexado à aula.");
  },
);

export const removeLessonFile = defineAction({ schema: lessonRefSchema, permission: "trainings.manage" }, async ({ id, trainingId }) => {
  const supabase = await createClient();
  const prev = must(await supabase.from("training_lessons").select("file_path").eq("id", id).eq("training_id", trainingId).single()) as { file_path: string | null };
  must(await supabase.from("training_lessons").update({ file_path: null, file_name: null }).eq("id", id).select("id").single());
  if (prev.file_path) await supabase.storage.from(BUCKET).remove([prev.file_path]);
  revalidatePath(page(trainingId));
  return ok(null, "Arquivo removido da aula.");
});

export const lessonFileUrl = defineAction({ schema: z.object({ path: z.string().regex(/^[0-9a-f-]{36}\//, "Arquivo inválido.") }) }, async ({ path }) => {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error || !data) return fail("forbidden", "Você não tem acesso a este arquivo.");
  return ok({ url: data.signedUrl });
});

// --- Progresso ----------------------------------------------------------------------

export const setLessonDone = defineAction({ schema: doneSchema }, async ({ lessonId, trainingId, done }, { user }) => {
  const supabase = await createClient();
  if (done) {
    const { error } = await supabase.from("training_progress").upsert({ lesson_id: lessonId, profile_id: user.id }, { onConflict: "lesson_id,profile_id", ignoreDuplicates: true });
    if (error) throw error;
  } else {
    must(await supabase.from("training_progress").delete().eq("lesson_id", lessonId).eq("profile_id", user.id));
  }
  revalidatePath(page(trainingId));
  revalidatePath(LIST);
  return ok(null, done ? "Aula concluída." : "Aula marcada como não concluída.");
});

// --- Atribuição ---------------------------------------------------------------------

export const assignTraining = defineAction({ schema: assignSchema, permission: "trainings.manage" }, async ({ trainingId, profileIds, dueOn }, { user }) => {
  const supabase = await createClient();
  const t = must(await supabase.from("trainings").select("is_published").eq("id", trainingId).single()) as { is_published: boolean };
  const { data: existing, error } = await supabase.from("training_assignments").select("profile_id").eq("training_id", trainingId).in("profile_id", profileIds);
  if (error) throw error;
  const already = new Set((existing ?? []).map((e) => e.profile_id));
  const fresh = profileIds.filter((p) => !already.has(p));
  if (fresh.length) must(await supabase.from("training_assignments").insert(fresh.map((p) => ({ training_id: trainingId, profile_id: p, due_on: dueOn, assigned_by: user.id }))).select("id"));
  if (already.size) must(await supabase.from("training_assignments").update({ due_on: dueOn }).eq("training_id", trainingId).in("profile_id", [...already]).select("id"));
  revalidatePath(page(trainingId));
  const n = fresh.length;
  const who = n === 1 ? "1 pessoa" : `${n} pessoas`;
  const msg = n === 0 ? "Prazo atualizado." : t.is_published ? `Treinamento atribuído a ${who}. Elas foram avisadas.` : `Atribuído a ${who}. Elas serão avisadas quando você publicar.`;
  return ok(null, msg);
});

export const unassignTraining = defineAction({ schema: z.object({ id: z.uuid(), trainingId: z.uuid() }), permission: "trainings.manage" }, async ({ id, trainingId }) => {
  const supabase = await createClient();
  must(await supabase.from("training_assignments").delete().eq("id", id).eq("training_id", trainingId).select("id").single());
  revalidatePath(page(trainingId));
  return ok(null, "Pessoa removida da lista. O progresso dela continua salvo.");
});
