import { z } from "zod";
import { parseBRL } from "@/domain/shared/money";

export const ackAlertSchema = z.object({ id: z.uuid("Alerta inválido.") });

export const resolveAlertSchema = z.object({
  id: z.uuid("Alerta inválido."),
  note: z.string().trim().min(3, "Conte em poucas palavras como foi resolvido.").max(500, "Até 500 caracteres."),
});

const money = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const cents = parseBRL(v);
    if (cents === null || cents <= 0) {
      ctx.addIssue({ code: "custom", message: "Valor inválido. Ex.: 300,00" });
      return z.NEVER;
    }
    return cents;
  });

const intIn = (min: number, max: number, msg: string) =>
  z.string().trim().transform((v, ctx) => {
    const n = Number(v);
    if (!v || !Number.isInteger(n) || n < min || n > max) {
      ctx.addIssue({ code: "custom", message: msg });
      return z.NEVER;
    }
    return n;
  });

/** Limites dos alertas: do cliente (clientId) ou o padrão da agência (null). */
export const limitsSchema = z.object({
  clientId: z.uuid("Cliente inválido.").nullable(),
  fundsDays: intIn(0, 30, "De 0 a 30 dias (0 não avisa por dias)."),
  fundsMin: money,
  dailySpendMax: money,
  noDelivery: z.boolean(),
  fatigueEnabled: z.boolean(),
  fatigueFrequency: z.string().trim().transform((v, ctx) => {
    const n = Number(v.replace(",", "."));
    if (!v || !Number.isFinite(n) || n < 1 || n > 20) {
      ctx.addIssue({ code: "custom", message: "De 1 a 20. Ex.: 3 ou 2,5" });
      return z.NEVER;
    }
    return Math.round(n * 10) / 10;
  }),
  fatigueCtrDrop: intIn(5, 90, "De 5% a 90%."),
});

export type LimitsInput = z.input<typeof limitsSchema>;

export const resetLimitsSchema = z.object({ clientId: z.uuid("Cliente inválido.") });
