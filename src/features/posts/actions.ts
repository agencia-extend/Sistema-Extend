"use server";

import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { ok } from "@/domain/shared/result";
import { createClient } from "@/lib/supabase/server";
import { postIdSchema, reschedulePostSchema, schedulePostSchema } from "./schemas";

const refresh = () => {
  revalidatePath("/publicacoes");
  revalidatePath("/clientes/[id]/redes", "page");
};

/** Programa a publicação (o banco confere permissão, perfis, formato, mídia e horário de novo). */
export const schedulePost = defineAction({ schema: schedulePostSchema, permission: "content.publish" }, async (v) => {
  const supabase = await createClient();
  const ids = must(
    await supabase.rpc("schedule_post", {
      p_client: v.clientId,
      p_profiles: v.profileIds,
      p_format: v.format,
      p_caption: v.caption,
      p_images: v.images,
      p_video_path: v.videoPath as string,
      p_video_drive_id: v.driveId as string,
      p_at: v.at,
      p_task: v.taskId as string,
    }),
  );
  refresh();
  return ok(null, ids.length > 1 ? `Publicação programada em ${ids.length} perfis.` : "Publicação programada.");
});

export const cancelPost = defineAction({ schema: postIdSchema, permission: "content.publish" }, async ({ id }) => {
  const supabase = await createClient();
  must(await supabase.rpc("cancel_post", { p_id: id }));
  refresh();
  return ok(null, "Publicação cancelada.");
});

export const reschedulePost = defineAction({ schema: reschedulePostSchema, permission: "content.publish" }, async ({ id, at }) => {
  const supabase = await createClient();
  must(await supabase.rpc("reschedule_post", { p_id: id, p_at: at }));
  refresh();
  return ok(null, "Publicação reagendada.");
});
