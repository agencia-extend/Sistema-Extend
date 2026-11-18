import { z } from "zod";
import { parseBRL } from "@/domain/shared/money";
import { unknownVariables } from "@/domain/ads/report";

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

// Ajustes das campanhas da Meta pelo sistema.
const level = z.enum(["campaign", "adset", "ad"], "Nível inválido.");
const why = z.string().trim().max(1000, "Até 1000 caracteres.").optional();

export const adStatusSchema = z.object({ level, id: z.uuid("Item inválido."), active: z.boolean(), why });

export const adBudgetSchema = z.object({
  level: z.enum(["campaign", "adset"], "Nível inválido."),
  id: z.uuid("Item inválido."),
  dailyBudget: z.union([z.number(), z.string()]).transform((v, ctx) => {
    const cents = typeof v === "number" ? Math.round(v) : parseBRL(v);
    if (cents === null || !Number.isFinite(cents) || cents < 100 || cents > 100_000_000) {
      ctx.addIssue({ code: "custom", message: "Informe o orçamento diário. Ex.: 50,00" });
      return z.NEVER;
    }
    return cents;
  }),
  why,
});
export type AdBudgetInput = z.input<typeof adBudgetSchema>;

export const adRenameSchema = z.object({ level, id: z.uuid("Item inválido."), name: z.string().trim().min(3, "Pelo menos 3 caracteres.").max(400, "Até 400 caracteres.") });

export const adDuplicateSchema = z.object({ level: z.enum(["campaign", "adset"], "Nível inválido."), id: z.uuid("Item inválido."), why });

export const campaignIdSchema = z.object({ campaignId: z.uuid("Campanha inválida.") });

// Modelos de relatório (RF-REL-02).
export const reportTemplateSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(2, "Dê um nome ao modelo.").max(80, "Use até 80 caracteres."),
    body: z.string().trim().min(10, "Escreva o texto do relatório.").max(4000, "Use até 4.000 caracteres."),
    isDefault: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    const bad = unknownVariables(v.body);
    if (bad.length) ctx.addIssue({ code: "custom", path: ["body"], message: `Variável que o sistema não conhece: ${bad.map((b) => `{${b}}`).join(", ")}. Use os botões de variáveis.` });
  });
export const reportTemplateIdSchema = z.object({ id: z.uuid() });
export const clientTemplateSchema = z.object({ clientId: z.uuid("Cliente inválido."), templateId: z.uuid().nullable() });
export const reportPreviewSchema = z.object({ clientId: z.uuid("Cliente inválido."), period: reportNowSchema.shape.period, templateId: z.uuid().nullable().optional() });
