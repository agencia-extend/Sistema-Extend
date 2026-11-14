"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { clientIp, RATE_LIMIT_MESSAGE, withinRateLimit } from "@/lib/rate-limit";
import { fail, ok, type ActionResult } from "@/domain/shared/result";
import { commentSchema, decisionSchema, deliverySchema, librarySchema, requestSchema, reviewSchema } from "./schemas";
import { z } from "zod";

const refresh = (taskId?: string) => {
  revalidatePath("/criativos", "layout");
  if (taskId) revalidatePath(`/tarefas/${taskId}`);
};
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Pedido do tráfego: cria a demanda no fluxo de criativos para a mídia do cliente. */
export const createCreativeRequest = defineAction({ schema: requestSchema, permission: "creatives.request.create" }, async (r) => {
  const supabase = await createClient();
  const id = must(
    await supabase.rpc("create_creative_request", {
      p: {
        client_id: r.clientId,
        campaign: r.campaign,
        objective: r.objective,
        format: r.format,
        quantity: r.quantity,
        variations: r.variations,
        angle: r.angle,
        audience: r.audience,
        cta: r.cta,
        copy_suggestion: r.copySuggestion,
        reference_links: r.references,
        due_at: new Date(`${r.dueOn}T18:00:00-03:00`).toISOString(),
        priority: r.priority,
        notes: r.notes,
      },
    }),
  ) as string;
  refresh();
  revalidatePath(`/clientes/${r.clientId}`, "layout");
  return ok({ id }, "Pedido enviado. A mídia do cliente foi avisada.");
});

/** Nova versão (v1, v2…). Os arquivos já foram enviados pelo navegador para o armazenamento. */
export const addDelivery = defineAction({ schema: deliverySchema }, async ({ taskId, note, assets }) => {
  const supabase = await createClient();
  const version = must(
    await supabase.rpc("add_delivery", {
      p_task: taskId,
      p_note: note,
      p_assets: assets.map((a) => ({ kind: a.kind, name: a.name, storage_path: a.storagePath ?? "", url: a.url ?? "", mime_type: a.mimeType ?? "", size_bytes: a.sizeBytes ?? "" })),
    }),
  ) as number;
  refresh(taskId);
  return ok({ version }, `Versão v${version} enviada. Quem pediu foi avisado.`);
});

const REVIEW_MESSAGE = { ajustes: "Ajustes pedidos. A mídia foi avisada.", cliente: "Aprovado internamente. Agora gere o link para o cliente.", aprovado: "Criativo aprovado e guardado na biblioteca.", entregue: "Marcado como entregue.", no_ar: "Marcado como no ar." } as const;

export const reviewCreative = defineAction({ schema: reviewSchema }, async ({ taskId, decision, comment }) => {
  const supabase = await createClient();
  must(await supabase.rpc("review_creative", { p_task: taskId, p_decision: decision, p_comment: comment }));
  refresh(taskId);
  return ok(null, REVIEW_MESSAGE[decision]);
});

/** Link do cliente: o código só aparece agora; o banco guarda o hash. Vale 7 dias. */
export const createApprovalLink = defineAction({ schema: z.object({ taskId: z.uuid() }) }, async ({ taskId }) => {
  const token = randomBytes(32).toString("base64url");
  const supabase = await createClient();
  must(await supabase.rpc("create_approval_link", { p_task: taskId, p_token_hash: hash(token), p_days: 7 }));
  refresh(taskId);
  return ok({ url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/aprovar/${token}` }, "Link criado. Ele vale por 7 dias e aceita uma decisão.");
});

export const addDeliveryComment = defineAction({ schema: commentSchema }, async ({ deliveryId, taskId, body }) => {
  const supabase = await createClient();
  must(await supabase.from("delivery_comments").insert({ delivery_id: deliveryId, body }).select("id").single());
  refresh(taskId);
  return ok(null, "Comentário enviado.");
});

export const updateLibraryItem = defineAction({ schema: librarySchema }, async ({ id, status, primaryText, headline, description }) => {
  const supabase = await createClient();
  must(
    await supabase
      .from("creative_library")
      .update({ status, primary_text: primaryText || null, headline: headline || null, description: description || null })
      .eq("id", id)
      .select("id")
      .single(),
  );
  revalidatePath("/criativos/biblioteca");
  return ok(null, "Biblioteca atualizada.");
});

const DECISION_STATE: Record<string, string> = {
  invalido: "Este link não existe. Confira se copiou o endereço inteiro.",
  usado: "Este link já recebeu uma decisão. Se precisar mudar algo, fale com a agência.",
  substituido: "Este link foi substituído por um mais novo. Peça o link atual à agência.",
  expirado: "Este link venceu. Peça um novo link à agência.",
};

/** Decisão do cliente pela página pública (sem login). Uma decisão por link; registra data, hora e IP. */
export async function decideApproval(raw: unknown): Promise<ActionResult<null>> {
  const parsed = decisionSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) (fieldErrors[i.path.join(".")] ??= []).push(i.message);
    return fail("validation", "Revise os campos destacados.", fieldErrors);
  }
  const ip = await clientIp();
  if (!(await withinRateLimit(`approval:${ip}`, 20, 900))) return fail("business_rule", RATE_LIMIT_MESSAGE);
  const { token, decision, comment, name } = parsed.data;
  const { data, error } = await createAdminClient().rpc("decide_approval", { p_token_hash: hash(token), p_decision: decision, p_comment: comment, p_name: name, p_ip: ip });
  if (error) {
    if (error.code === "P0001") return fail("validation", error.message);
    console.error("[decideApproval]", error.code);
    return fail("unknown", "Não foi possível registrar a decisão agora. Tente de novo em instantes.");
  }
  if (data !== "ok") return fail("business_rule", DECISION_STATE[data as string] ?? DECISION_STATE.invalido);
  revalidatePath(`/aprovar/${token}`);
  return ok(null, decision === "aprovado" ? "Obrigado! Aprovação registrada." : "Obrigado! Seu pedido de alteração foi enviado para a equipe.");
}
