import { z } from "zod";

export const portalInviteSchema = z.object({
  clientId: z.uuid(),
  email: z.email("Informe um e-mail válido.").trim().toLowerCase().max(200),
  fullName: z.string().trim().min(2, "Informe o nome.").max(120),
});

export const portalInvitationIdSchema = z.object({ clientId: z.uuid(), id: z.uuid() });

export const portalUserActiveSchema = z.object({ clientId: z.uuid(), userId: z.uuid(), active: z.boolean() });

export const strategySchema = z.object({
  clientId: z.uuid(),
  body: z.string().max(20000, "Texto longo demais (máximo de 20 mil caracteres)."),
  publish: z.boolean(),
});

export const portalDecisionSchema = z
  .object({
    taskId: z.uuid(),
    decision: z.enum(["aprovado", "ajustes"]),
    comment: z.string().trim().max(2000, "Use no máximo 2.000 caracteres.").default(""),
  })
  .refine((v) => v.decision === "aprovado" || v.comment.length >= 3, { path: ["comment"], message: "Descreva o que precisa mudar." });
