import { z } from "zod";
import { parseBRL } from "@/domain/shared/money";

export const syncNowSchema = z.object({ clientId: z.uuid("Cliente inválido.").nullable() });

export const reportNowSchema = z.object({ clientId: z.uuid("Cliente inválido."), period: z.enum(["hoje", "ontem", "7d", "30d", "mes", "semana"]) });

const optionalMoney = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const cents = parseBRL(v);
    if (cents === null || cents <= 0) {
      ctx.addIssue({ code: "custom", message: "Valor inválido. Ex.: 1.500,00" });
      return z.NEVER;
    }
    return cents;
  });

export const goalSchema = z
  .object({
    clientId: z.uuid("Cliente inválido."),
    month: z.string().regex(/^\d{4}-\d{2}-01$/, "Mês inválido."),
    resultKind: z.enum(["leads", "messages", "purchases", "link_clicks"], { message: "Escolha o resultado." }),
    resultsTarget: z.string().trim().transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v.replace(/\D/g, ""));
      if (!Number.isInteger(n) || n <= 0) {
        ctx.addIssue({ code: "custom", message: "Informe um número inteiro maior que zero." });
        return z.NEVER;
      }
      return n;
    }),
    spend: optionalMoney,
    maxCost: optionalMoney,
    minRoas: z.string().trim().transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0 || n > 1000) {
        ctx.addIssue({ code: "custom", message: "Ex.: 3 ou 2,5" });
        return z.NEVER;
      }
      return Math.round(n * 100) / 100;
    }),
    notes: z.string().trim().max(500, "Até 500 caracteres.").transform((v) => v || null),
  })
  .refine((g) => g.resultsTarget || g.spend || g.maxCost || g.minRoas, { message: "Defina pelo menos uma meta.", path: ["resultsTarget"] });

export type GoalInput = z.input<typeof goalSchema>;

export const goalIdSchema = z.object({ id: z.uuid(), clientId: z.uuid() });
