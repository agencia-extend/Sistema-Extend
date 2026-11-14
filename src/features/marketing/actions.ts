"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { ok, type ActionResult } from "@/domain/shared/result";
import { marketingDateSchema } from "./schemas";

const PATH = "/calendario-marketing";

export const saveMarketingDate = defineAction({ schema: marketingDateSchema, permission: "marketing_calendar.manage" }, async (d): Promise<ActionResult<{ id: string; requestTaskId: string | null }>> => {
  const supabase = await createClient();
  const id = must(
    await supabase.rpc("save_marketing_date", {
      p: {
        id: d.id ?? null,
        client_id: d.clientId,
        title: d.title,
        on_date: d.onDate,
        kind: d.kind,
        notes: d.notes,
        lead_days: d.leadDays,
        brief: d.brief,
      },
    }),
  ) as string;
  const { data } = await supabase.from("marketing_dates").select("request_task_id").eq("id", id).single();
  revalidatePath(PATH);
  revalidatePath("/criativos");
  if (data?.request_task_id) return ok({ id, requestTaskId: data.request_task_id }, "Data salva. O pedido de criativo já foi para a fila de Criativos.");
  return ok({ id, requestTaskId: null }, d.brief ? "Data salva. O pedido de criativo sai sozinho na antecedência escolhida." : "Data salva.");
});

export const deleteMarketingDate = defineAction({ schema: z.object({ id: z.uuid() }), permission: "marketing_calendar.manage" }, async ({ id }) => {
  const supabase = await createClient();
  must(await supabase.rpc("delete_marketing_date", { p_id: id }));
  revalidatePath(PATH);
  return ok(null, "Data excluída. Um pedido de criativo já criado continua em Criativos.");
});
