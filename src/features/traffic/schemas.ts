import { z } from "zod";
import { BUDGET_CHANNELS, BUDGET_PLATFORMS, CHANGE_CATEGORIES, PLATFORMS } from "@/domain/traffic";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");

export const changeSchema = z.object({
  id: z.uuid().optional(),
  clientId: z.uuid(),
  platform: z.enum(PLATFORMS).nullable().default(null),
  category: z.enum(CHANGE_CATEGORIES, { message: "Escolha o tipo de alteração." }),
  happenedOn: day,
  what: z.string().trim().min(3, "Descreva o que mudou.").max(500, "Use até 500 caracteres."),
  why: z.string().trim().min(3, "Conte por que mudou.").max(1000, "Use até 1000 caracteres."),
});
export type ChangeInput = z.infer<typeof changeSchema>;

export const budgetSchema = z
  .object({
    id: z.uuid().optional(),
    clientId: z.uuid(),
    amountCents: z.number({ message: "Informe o valor." }).int().positive("Informe um valor maior que zero.").max(100_000_000_00, "Valor alto demais."),
    platform: z.enum(BUDGET_PLATFORMS, { message: "Escolha a plataforma." }),
    periodStart: day,
    periodEnd: day,
    approvedBy: z.string().trim().min(2, "Quem aprovou no cliente?").max(120),
    approvedOn: day,
    channel: z.enum(BUDGET_CHANNELS, { message: "Escolha por onde foi aprovado." }),
    notes: z.string().trim().max(1000, "Use até 1000 caracteres.").default(""),
  })
  .refine((v) => v.periodEnd >= v.periodStart, { path: ["periodEnd"], message: "O fim vem depois do início." });
export type BudgetInput = z.infer<typeof budgetSchema>;
