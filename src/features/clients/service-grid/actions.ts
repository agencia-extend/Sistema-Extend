"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction } from "@/lib/actions";
import { fail, ok } from "@/domain/shared/result";
import { mapDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  mode: z.enum(["proximo", "agora"]),
  changes: z
    .array(z.object({ clientId: z.uuid(), serviceId: z.uuid(), qty: z.number().int().min(0, "Use 0 ou mais.").max(200, "Use até 200.") }))
    .min(1, "Nenhuma quantidade foi alterada.")
    .max(1000),
});

/**
 * Salva as quantidades alteradas na tabela de serviços em lote. "proximo": vale a partir do próximo mês de cada cliente
 * (como no cliente). "agora": vale já neste mês e cria as demandas do mês que faltarem.
 */
export const saveServiceGrid = defineAction({ schema, permission: "clients.manage" }, async ({ mode, changes }) => {
  const supabase = await createClient();
  let saved = 0;
  let slots = 0;
  const errors: string[] = [];
  for (const c of changes) {
    const res =
      mode === "agora"
        ? await supabase.rpc("set_client_service_now", { p_client: c.clientId, p_service: c.serviceId, p_qty: c.qty })
        : await supabase.rpc("set_client_service", { p_client: c.clientId, p_service: c.serviceId, p_qty: c.qty });
    if (res.error) {
      errors.push(mapDbError(res.error).message);
      continue;
    }
    saved++;
    if (mode === "agora") slots += Number(res.data ?? 0);
  }
  revalidatePath("/clientes", "layout");
  revalidatePath("/cronogramas");
  if (!saved) return fail("business_rule", errors[0] ?? "Nada foi salvo.");
  const base = `${saved} ${saved === 1 ? "quantidade salva" : "quantidades salvas"}`;
  const extra = mode === "agora" ? (slots ? `; ${slots} ${slots === 1 ? "demanda do mês criada" : "demandas do mês criadas"}` : "; as demandas do mês já existiam") : "; valem a partir do próximo mês de cada cliente";
  const failed = errors.length ? ` ${errors.length} não ${errors.length === 1 ? "foi salva" : "foram salvas"}: ${errors[0]}` : "";
  return ok({ saved, slots, failed: errors.length }, `${base}${extra}.${failed}`);
});
