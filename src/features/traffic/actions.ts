"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { fail, ok } from "@/domain/shared/result";
import { createClient } from "@/lib/supabase/server";
import { budgetSchema, changeSchema, checkSchema } from "./schemas";

const MAX_FILE = 10 * 1024 * 1024;
const page = (clientId: string) => `/clientes/${clientId}/trafego`;
const safeName = (n: string) =>
  n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-120);

/** Registrar ou corrigir uma alteração (a RLS só deixa quem otimiza o cliente; corrigir, só quem registrou). */
export const saveChange = defineAction({ schema: changeSchema, permission: "optimization.manage" }, async ({ id, clientId, ...v }) => {
  const supabase = await createClient();
  const row = { platform: v.platform, category: v.category, happened_on: v.happenedOn, what: v.what, why: v.why };
  if (id) {
    const { data } = await supabase.from("change_logs").update(row).eq("id", id).select("id");
    if (!data?.length) return fail("forbidden", "Só quem registrou pode corrigir esta alteração.");
  } else must(await supabase.from("change_logs").insert({ ...row, client_id: clientId }).select("id").single());
  revalidatePath(page(clientId));
  revalidatePath(`/clientes/${clientId}/historico`);
  return ok(null, id ? "Alteração corrigida." : "Alteração registrada.");
});

export const deleteChange = defineAction({ schema: z.object({ id: z.uuid(), clientId: z.uuid() }), permission: "optimization.manage" }, async ({ id, clientId }) => {
  const supabase = await createClient();
  const { data } = await supabase.from("change_logs").delete().eq("id", id).select("id");
  if (!data?.length) return fail("forbidden", "Só quem registrou pode apagar esta alteração.");
  revalidatePath(page(clientId));
  return ok(null, "Alteração apagada.");
});

/** Verba aprovada pelo cliente, com comprovante opcional (print ou áudio, até 10 MB, em Documentos › Tráfego). */
export async function saveBudget(form: FormData) {
  const file = form.get("file");
  return saveBudgetAction({
    input: {
      id: form.get("id") || undefined,
      clientId: form.get("clientId"),
      amountCents: Number(form.get("amountCents")),
      platform: form.get("platform") || undefined,
      periodStart: form.get("periodStart") ?? "",
      periodEnd: form.get("periodEnd") ?? "",
      approvedBy: form.get("approvedBy") ?? "",
      approvedOn: form.get("approvedOn") ?? "",
      channel: form.get("channel") || undefined,
      notes: form.get("notes") ?? "",
    },
    file: file instanceof File && file.size > 0 ? file : undefined,
  });
}

const saveBudgetAction = defineAction(
  { schema: z.object({ input: budgetSchema, file: z.instanceof(File).optional() }), permission: "optimization.manage" },
  async ({ input: { id, clientId, ...v }, file }, { user }) => {
    const supabase = await createClient();
    let fileId: string | undefined;
    let path: string | null = null;
    if (file) {
      if (file.size > MAX_FILE) return fail("validation", "Comprovante maior que 10 MB.", { file: ["Maior que 10 MB."] });
      if (!/^(image|audio)\/|^application\/pdf$/.test(file.type)) return fail("validation", "Envie um print (imagem), um áudio ou um PDF.", { file: ["Use imagem, áudio ou PDF."] });
      path = `clientes/${clientId}/${randomUUID()}-${safeName(file.name)}`;
      const up = await supabase.storage.from("anexos").upload(path, file, { contentType: file.type });
      if (up.error) return fail("forbidden", "Não foi possível enviar o comprovante. Verifique se você tem acesso a este cliente.");
      const row = await supabase
        .from("client_files")
        .insert({ client_id: clientId, storage_path: path, name: `Comprovante de verba - ${file.name}`.slice(0, 200), mime_type: file.type, size_bytes: file.size, category: "geral", folder: "trafego", uploaded_by: user.id })
        .select("id")
        .single();
      if (row.error) {
        await supabase.storage.from("anexos").remove([path]);
        throw row.error;
      }
      fileId = row.data.id;
    }
    const row = {
      amount_cents: v.amountCents,
      platform: v.platform,
      period_start: v.periodStart,
      period_end: v.periodEnd,
      approved_by: v.approvedBy,
      approved_on: v.approvedOn,
      channel: v.channel,
      notes: v.notes || null,
      ...(fileId ? { proof_file_id: fileId } : {}),
    };
    const res = id
      ? await supabase.from("budget_approvals").update(row).eq("id", id).select("id")
      : await supabase.from("budget_approvals").insert({ ...row, client_id: clientId }).select("id");
    if (res.error || !res.data?.length) {
      if (fileId) await supabase.from("client_files").delete().eq("id", fileId);
      if (path) await supabase.storage.from("anexos").remove([path]);
      if (res.error) throw res.error;
      return fail("forbidden", "Você não pode alterar esta verba.");
    }
    revalidatePath(page(clientId));
    revalidatePath(`/clientes/${clientId}/arquivos`);
    return ok(null, id ? "Verba atualizada." : "Verba registrada. A equipe de tráfego do cliente foi avisada.");
  },
);

export const deleteBudget = defineAction({ schema: z.object({ id: z.uuid(), clientId: z.uuid() }), permission: "optimization.manage" }, async ({ id, clientId }) => {
  const supabase = await createClient();
  const { data } = await supabase.from("budget_approvals").delete().eq("id", id).select("id");
  if (!data?.length) return fail("forbidden", "Você não pode apagar esta verba.");
  revalidatePath(page(clientId));
  return ok(null, "Verba apagada. O comprovante continua em Documentos › Tráfego.");
});

/** Checklist diário ou semanal do cliente (RF-OTI-01/02). Um por cliente e período; salvar de novo atualiza. */
export const saveCheck = defineAction({ schema: checkSchema, permission: "optimization.manage" }, async ({ clientId, kind, periodOn, items, decisions, notes }) => {
  const supabase = await createClient();
  const row = { items, decisions, notes: notes || null };
  const { data: existing } = await supabase.from("traffic_checks").select("id").eq("client_id", clientId).eq("kind", kind).eq("period_on", periodOn).maybeSingle();
  if (existing) {
    const data = must(await supabase.from("traffic_checks").update(row).eq("id", existing.id).select("id"));
    if (!data?.length) return fail("forbidden", "Você não pode alterar este checklist.");
  } else must(await supabase.from("traffic_checks").insert({ ...row, client_id: clientId, kind, period_on: periodOn }).select("id").single());
  revalidatePath(page(clientId));
  revalidatePath("/trafego");
  const problems = items.filter((i) => i.status === "problema").length;
  const what = kind === "diario" ? "Checklist do dia" : "Checklist da semana";
  return ok(null, existing ? `${what} atualizado.` : problems ? `${what} salvo com ${problems} ${problems === 1 ? "problema" : "problemas"} no histórico do cliente.` : `${what} salvo.`);
});
