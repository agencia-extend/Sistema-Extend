"use server";

import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { ok } from "@/domain/shared/result";
import { idSchema, routineSchema, templateSchema } from "./schemas";

const PAGE = "/configuracoes/rotinas";

export const saveRoutine = defineAction({ schema: routineSchema, permission: "tasks.boards.configure" }, async (r, { user }) => {
  const supabase = await createClient();
  const row = {
    organization_id: user.organizationId,
    service_id: r.serviceId,
    title: r.title,
    description: r.description || null,
    sector_id: r.sectorId,
    weekday: r.weekday,
    due_hour: r.dueHour,
    lead_days: r.leadDays,
    is_active: r.isActive,
  };
  if (r.id) must(await supabase.from("service_routines").update(row).eq("id", r.id).select("id").single());
  else must(await supabase.from("service_routines").insert(row).select("id").single());
  revalidatePath(PAGE);
  return ok(null, r.id ? "Rotina salva." : "Rotina criada. As demandas aparecem até 3 dias antes do dia marcado.");
});

export const deleteRoutine = defineAction({ schema: idSchema, permission: "tasks.boards.configure" }, async ({ id }) => {
  const supabase = await createClient();
  must(await supabase.from("service_routines").delete().eq("id", id).select("id").single());
  revalidatePath(PAGE);
  return ok(null, "Rotina excluída. As demandas já criadas continuam.");
});

export const saveTemplate = defineAction({ schema: templateSchema, permission: "tasks.boards.configure" }, async (t, { user }) => {
  const supabase = await createClient();
  const row = {
    organization_id: user.organizationId,
    name: t.name,
    category: t.category,
    type: t.type,
    description: t.description || null,
    due_days: t.dueDays,
    priority: t.priority,
    repeat_unit: t.repeat?.unit ?? null,
    repeat_every: t.repeat?.every ?? null,
    is_active: t.isActive,
  };
  if (t.id) must(await supabase.from("task_templates").update(row).eq("id", t.id).select("id").single());
  else must(await supabase.from("task_templates").insert({ ...row, position: 1000 }).select("id").single());
  revalidatePath(PAGE);
  revalidatePath("/tarefas");
  return ok(null, t.id ? "Modelo salvo." : "Modelo criado.");
});

export const deleteTemplate = defineAction({ schema: idSchema, permission: "tasks.boards.configure" }, async ({ id }) => {
  const supabase = await createClient();
  must(await supabase.from("task_templates").delete().eq("id", id).select("id").single());
  revalidatePath(PAGE);
  return ok(null, "Modelo excluído.");
});
