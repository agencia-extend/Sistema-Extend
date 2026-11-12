"use server";

import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { ok } from "@/domain/shared/result";
import type { Json } from "@/lib/supabase/database.types";
import { contentSchema } from "./schemas";

/** Salva os campos do conteúdo (Controle de Mídias). Permissão e avisos ficam no banco (save_content). */
export const saveContent = defineAction({ schema: contentSchema, permission: "tasks.manage" }, async (c) => {
  const p: Record<string, Json> = {};
  if (c.title !== undefined) p.title = c.title;
  if (c.format !== undefined) p.format = c.format;
  if (c.objective !== undefined) p.objective = c.objective;
  if (c.script !== undefined) p.script = c.script;
  if (c.caption !== undefined) p.caption = c.caption;
  if (c.recorderId !== undefined) p.recorder_id = c.recorderId ?? "";
  if (c.recordingOn !== undefined) p.recording_on = c.recordingOn;
  if (c.editorId !== undefined) p.editor_id = c.editorId ?? "";
  if (c.finalUrl !== undefined) p.final_url = c.finalUrl;
  if (c.rawUrl !== undefined) p.raw_url = c.rawUrl;
  if (c.postOn !== undefined) p.post_on = c.postOn;
  if (c.postUrl !== undefined) p.post_url = c.postUrl;
  if (c.destination !== undefined) p.destination = c.destination;
  // Prazo: fim do expediente (18h) em São Paulo, como as demandas geradas.
  if (c.dueOn !== undefined) p.due_at = c.dueOn ? new Date(`${c.dueOn}T18:00:00-03:00`).toISOString() : "";

  const supabase = await createClient();
  must(await supabase.rpc("save_content", { p_task: c.taskId, p }));
  const { data } = await supabase.from("tasks").select("client_id").eq("id", c.taskId).maybeSingle();
  if (data?.client_id) revalidatePath(`/clientes/${data.client_id}`, "layout");
  revalidatePath(`/tarefas/${c.taskId}`);
  revalidatePath("/tarefas");
  revalidatePath("/setores", "layout");
  revalidatePath("/producao");
  return ok(undefined, "Conteúdo salvo.");
});
