import { z } from "zod";
import { BUDGET_CHANNELS, BUDGET_PLATFORMS, CHANGE_CATEGORIES, CHECK_ITEMS, CHECK_KINDS, CHECK_STATUSES, DECISIONS, DECISION_LEVELS, PLATFORMS } from "@/domain/traffic";
import { CREATIVE_FORMATS } from "@/domain/creatives";
import { REJECTION_OUTCOMES, REJECTION_REASONS } from "@/domain/creatives/rejections";

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

const checkItem = z
  .object({ key: z.string(), status: z.enum(CHECK_STATUSES, { message: "Marque o item." }), note: z.string().trim().max(500, "Use até 500 caracteres.").default("") })
  .refine((i) => i.status !== "problema" || i.note.length >= 3, { path: ["note"], message: "Conte qual é o problema." });

const decision = z.object({
  level: z.enum(DECISION_LEVELS, { message: "Escolha o nível." }),
  target: z.string().trim().min(2, "Qual campanha, conjunto ou anúncio?").max(200, "Use até 200 caracteres."),
  decision: z.enum(DECISIONS, { message: "Escolha a decisão." }),
  why: z.string().trim().min(3, "Conte o motivo.").max(1000, "Use até 1000 caracteres."),
});

export const checkSchema = z
  .object({
    clientId: z.uuid(),
    kind: z.enum(CHECK_KINDS),
    periodOn: day,
    items: z.array(checkItem),
    decisions: z.array(decision).max(30, "Use até 30 decisões.").default([]),
    notes: z.string().trim().max(1000, "Use até 1000 caracteres.").default(""),
  })
  .superRefine((v, ctx) => {
    const keys = CHECK_ITEMS[v.kind].map((i) => i.key);
    if (v.items.length !== keys.length || !keys.every((k) => v.items.some((i) => i.key === k)))
      ctx.addIssue({ code: "custom", path: ["items"], message: "Marque todos os itens do checklist." });
    if (v.kind === "diario" && v.decisions.length) ctx.addIssue({ code: "custom", path: ["decisions"], message: "Decisões são do checklist semanal." });
  });
export type CheckInput = z.infer<typeof checkSchema>;

export const rejectionSchema = z.object({
  id: z.uuid().optional(),
  clientId: z.uuid(),
  libraryId: z.uuid().nullable().default(null),
  platform: z.enum(["meta", "google"], { message: "Escolha a plataforma." }),
  rejectedOn: day,
  format: z.enum(CREATIVE_FORMATS, { message: "Escolha o formato." }),
  angle: z.string().trim().min(2, "Qual era o ângulo ou a mensagem do anúncio?").max(300, "Use até 300 caracteres."),
  reason: z.enum(REJECTION_REASONS, { message: "Escolha o motivo." }),
  policyText: z.string().trim().min(3, "Cole ou resuma o que a Meta disse.").max(1000, "Use até 1000 caracteres."),
  adName: z.string().trim().max(200, "Use até 200 caracteres.").default(""),
  outcome: z.enum(REJECTION_OUTCOMES).nullable().default(null),
  lesson: z.string().trim().max(500, "Use até 500 caracteres.").default(""),
});
export type RejectionInput = z.infer<typeof rejectionSchema>;
