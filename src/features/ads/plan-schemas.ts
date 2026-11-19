import { z } from "zod";
import { PLAN_OBJECTIVES, PLAN_PLATFORMS, PLAN_STATUSES } from "@/domain/ads/plans";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");

export const planSchema = z
  .object({
    id: z.uuid().optional(),
    clientId: z.uuid({ message: "Escolha o cliente." }),
    name: z.string().trim().min(3, "Dê o nome da campanha (o nome padrão liga o plano à campanha real).").max(200, "Use até 200 caracteres."),
    platform: z.enum(PLAN_PLATFORMS, { message: "Escolha a plataforma." }),
    objective: z.enum(PLAN_OBJECTIVES, { message: "Escolha o objetivo." }),
    budgetType: z.enum(["diario", "total"], { message: "Diário ou total?" }),
    budgetCents: z.number({ message: "Informe o orçamento." }).int().positive("Informe um valor maior que zero.").max(100_000_000_00, "Valor alto demais."),
    audience: z.string().trim().min(3, "Descreva o público.").max(1000, "Use até 1000 caracteres."),
    startDate: day,
    endDate: z.union([day, z.literal("")]).default(""),
    notes: z.string().trim().max(2000, "Use até 2000 caracteres.").default(""),
    libraryIds: z.array(z.uuid()).max(30, "Até 30 criativos.").default([]),
    requestIds: z.array(z.uuid()).max(30, "Até 30 pedidos.").default([]),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "O fim vem depois do início." })
  .refine((v) => v.budgetType === "diario" || Boolean(v.endDate), { path: ["endDate"], message: "Com orçamento total, informe o fim." });
export type PlanInput = z.infer<typeof planSchema>;

export const planStatusSchema = z
  .object({
    id: z.uuid(),
    clientId: z.uuid(),
    status: z.enum(PLAN_STATUSES),
    approvedBy: z.string().trim().max(120).default(""),
    approvedOn: z.union([day, z.literal("")]).default(""),
  })
  .refine((v) => v.status !== "aprovado" || v.approvedBy.length >= 2, { path: ["approvedBy"], message: "Quem aprovou no cliente?" })
  .refine((v) => v.status !== "aprovado" || Boolean(v.approvedOn), { path: ["approvedOn"], message: "Informe a data da aprovação." });
export type PlanStatusInput = z.infer<typeof planStatusSchema>;

export const planLinkSchema = z.object({ id: z.uuid(), clientId: z.uuid(), campaignId: z.uuid().nullable() });
