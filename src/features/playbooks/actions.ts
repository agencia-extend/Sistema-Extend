"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { fail, ok } from "@/domain/shared/result";
import { applySchema, moveStepSchema, playbookSchema, stepSchema } from "./schemas";

const refresh = (id?: string) => {
  revalidatePath("/playbooks");
  if (id) revalidatePath(`/playbooks/${id}`);
};

export const savePlaybook = defineAction({ schema: playbookSchema, permission: "playbooks.manage" }, async ({ id, name, area, description, isActive }) => {
  const supabase = await createClient();
  const row = { name, area, description: description || null, is_active: isActive };
  if (id) {
    must(await supabase.from("playbooks").update(row).eq("id", id).select("id").single());
    refresh(id);
    return ok({ id }, "Playbook salvo.");
  }
  const created = must(await supabase.from("playbooks").insert(row).select("id").single()) as { id: string };
  refresh(created.id);
  return ok({ id: created.id }, "Playbook criado. Agora adicione as etapas.");
});

export const deletePlaybook = defineAction({ schema: z.object({ id: z.uuid() }), permission: "playbooks.manage" }, async ({ id }) => {
  const supabase = await createClient();
  must(await supabase.from("playbooks").delete().eq("id", id).select("id").single());
  refresh();
  return ok(null, "Playbook excluído. O que já foi aplicado nos clientes continua.");
});

export const saveStep = defineAction({ schema: stepSchema, permission: "playbooks.manage" }, async (s) => {
  const supabase = await createClient();
  const row = {
    title: s.title,
    guidance: s.guidance || null,
    offset_days: s.offsetDays,
    day_kind: s.dayKind,
    sector_id: s.sectorId,
    task_type: s.taskType,
    milestone: s.milestone || null,
  };
  if (s.id) must(await supabase.from("playbook_steps").update(row).eq("id", s.id).select("id").single());
  else {
    const { data: last } = await supabase.from("playbook_steps").select("position").eq("playbook_id", s.playbookId).order("position", { ascending: false }).limit(1).maybeSingle();
    must(await supabase.from("playbook_steps").insert({ ...row, playbook_id: s.playbookId, position: (last?.position ?? 0) + 1 }).select("id").single());
  }
  refresh(s.playbookId);
  return ok(null, s.id ? "Etapa salva." : "Etapa adicionada.");
});

export const deleteStep = defineAction({ schema: z.object({ id: z.uuid(), playbookId: z.uuid() }), permission: "playbooks.manage" }, async ({ id, playbookId }) => {
  const supabase = await createClient();
  must(await supabase.from("playbook_steps").delete().eq("id", id).select("id").single());
  refresh(playbookId);
  return ok(null, "Etapa excluída.");
});

export const moveStep = defineAction({ schema: moveStepSchema, permission: "playbooks.manage" }, async ({ id, playbookId, direction }) => {
  const supabase = await createClient();
  const steps = must(await supabase.from("playbook_steps").select("id, position").eq("playbook_id", playbookId).order("position")) as { id: string; position: number }[];
  const i = steps.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= steps.length) return ok(null);
  [steps[i], steps[j]] = [steps[j], steps[i]];
  for (const [n, s] of steps.entries()) {
    if (s.position !== n + 1) must(await supabase.from("playbook_steps").update({ position: n + 1 }).eq("id", s.id).select("id").single());
  }
  refresh(playbookId);
  return ok(null);
});

export const applyPlaybook = defineAction({ schema: applySchema, permission: "playbooks.apply" }, async ({ playbookId, clientId, startOn }) => {
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_playbook", { p_playbook: playbookId, p_client: clientId, p_start: startOn });
  if (error) {
    if (error.code === "P0001" || error.code === "P0002") return fail("business_rule", error.message);
    throw error;
  }
  revalidatePath(`/clientes/${clientId}`, "layout");
  revalidatePath("/tarefas");
  return ok({ clientId }, "Demandas e marcos criados. Os responsáveis foram avisados.");
});
