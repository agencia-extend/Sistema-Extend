"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { fail, ok } from "@/domain/shared/result";
import { postSchema, recordingSchema } from "./schemas";

const uuid = z.uuid();

const refresh = (clientId: string) => {
  revalidatePath(`/clientes/${clientId}`, "layout");
  revalidatePath("/producao");
};


/** Programa o post: data, legenda e link do post publicado (entra no cronograma). */
export const schedulePost = defineAction({ schema: postSchema, permission: "tasks.manage" }, async ({ clientId, taskId, postOn, caption, postUrl }) => {
  const supabase = await createClient();
  const { data: cur } = await supabase.from("task_content").select("destination").eq("task_id", taskId).maybeSingle();
  const destination = [...new Set([...(cur?.destination ?? []), "cronograma"])];
  must(await supabase.rpc("save_content", { p_task: taskId, p: { post_on: postOn, caption, post_url: postUrl, destination } }));
  refresh(clientId);
  return ok(null, postUrl ? "Post marcado como publicado." : postOn ? "Post programado." : "Post salvo no cronograma, ainda sem data.");
});

const MAX_COVER = 5 * 1024 * 1024;

/** Capa do post para a prévia do feed (imagem até 5 MB). Substitui a anterior. */
export async function uploadCover(form: FormData) {
  return coverAction({ clientId: form.get("clientId"), taskId: form.get("taskId"), file: form.get("file") });
}

const coverAction = defineAction(
  { schema: z.object({ clientId: uuid, taskId: uuid, file: z.instanceof(File, { message: "Escolha uma imagem." }) }), permission: "tasks.manage" },
  async ({ clientId, taskId, file }) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return fail("validation", "Use uma imagem JPG, PNG ou WebP.");
    if (file.size > MAX_COVER) return fail("validation", "Imagem maior que 5 MB. Exporte em tamanho menor.");
    const supabase = await createClient();
    const { data: old } = await supabase.from("task_content").select("cover_path").eq("task_id", taskId).maybeSingle();
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `clientes/${clientId}/capas/${randomUUID()}.${ext}`;
    const up = await supabase.storage.from("anexos").upload(path, file, { contentType: file.type });
    if (up.error) return fail("forbidden", "Não foi possível enviar a capa. Verifique se você tem acesso a este cliente.");
    const { error } = await supabase.rpc("set_content_cover", { p_task: taskId, p_path: path });
    if (error) {
      await supabase.storage.from("anexos").remove([path]);
      throw error;
    }
    if (old?.cover_path) await supabase.storage.from("anexos").remove([old.cover_path]);
    refresh(clientId);
    return ok(null, "Capa atualizada.");
  },
);


export const saveRecording = defineAction({ schema: recordingSchema, permission: "tasks.manage" }, async (r) => {
  const supabase = await createClient();
  must(
    await supabase.rpc("save_recording", {
      p: { id: r.id ?? "", client_id: r.clientId, recorded_on: r.recordedOn, location: r.location, raw_url: r.rawUrl, notes: r.notes, people: r.people, tasks: r.tasks },
    }),
  );
  refresh(r.clientId);
  return ok(null, r.tasks.length ? `Gravação registrada com ${r.tasks.length} conteúdo(s). Quem edita foi avisado.` : "Gravação registrada.");
});

export const deleteRecording = defineAction({ schema: z.object({ id: uuid, clientId: uuid }) }, async ({ id, clientId }) => {
  const supabase = await createClient();
  must(await supabase.from("recording_sessions").delete().eq("id", id).select("id").single());
  refresh(clientId);
  return ok(null, "Gravação excluída.");
});
