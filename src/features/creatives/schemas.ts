import { z } from "zod";
import { CREATIVE_FORMATS, CREATIVE_OBJECTIVES, LIBRARY_STATUSES } from "@/domain/creatives";

const uuid = z.uuid();
const req = (label: string, max: number) => z.string().trim().min(2, `Informe ${label}.`).max(max, `Use até ${max} caracteres.`);

export const requestSchema = z.object({
  clientId: z.uuid({ message: "Escolha o cliente." }),
  campaign: req("a campanha", 160),
  objective: z.enum(CREATIVE_OBJECTIVES, { message: "Escolha o objetivo." }),
  format: z.enum(CREATIVE_FORMATS, { message: "Escolha o formato." }),
  quantity: z.number({ message: "Informe a quantidade." }).int().min(1, "Peça ao menos 1.").max(50, "Até 50 por pedido."),
  variations: z.number().int().min(0).max(20, "Até 20 variações."),
  angle: req("o ângulo ou a mensagem", 300),
  audience: req("o público", 300),
  cta: req("a chamada (CTA)", 120),
  copySuggestion: z.string().trim().max(3000, "Use até 3000 caracteres.").default(""),
  references: z.array(z.string().trim().refine((v) => /^https?:\/\//.test(v), "Cada referência precisa ser um link (https://…).")).max(10, "Até 10 referências.").default([]),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o prazo."),
  priority: z.enum(["baixa", "media", "alta", "urgente"], { message: "Escolha a prioridade." }),
  notes: z.string().trim().max(2000, "Use até 2000 caracteres.").default(""),
});
export type RequestInput = z.infer<typeof requestSchema>;

export const assetSchema = z.object({
  kind: z.enum(["arquivo", "link"]),
  name: z.string().trim().min(1).max(200),
  storagePath: z.string().regex(/^tarefas\/[0-9a-f-]{36}\/entregas\//).optional(),
  url: z.string().trim().max(1000).refine((v) => /^https?:\/\//.test(v), "O link precisa começar com https://").optional(),
  mimeType: z.string().max(120).optional(),
  sizeBytes: z.number().int().min(0).optional(),
});

export const deliverySchema = z.object({
  taskId: uuid,
  note: z.string().trim().max(2000, "Use até 2000 caracteres.").default(""),
  assets: z.array(assetSchema).min(1, "Envie ao menos um arquivo ou link.").max(20),
});

export const reviewSchema = z
  .object({ taskId: uuid, decision: z.enum(["ajustes", "cliente", "aprovado", "entregue", "no_ar"]), comment: z.string().trim().max(2000).default("") })
  .refine((v) => v.decision !== "ajustes" || v.comment.length >= 3, { path: ["comment"], message: "Descreva o que precisa mudar." });

export const commentSchema = z.object({ deliveryId: uuid, taskId: uuid, body: z.string().trim().min(1, "Escreva o comentário.").max(2000) });

export const librarySchema = z.object({
  id: uuid,
  status: z.enum(LIBRARY_STATUSES),
  primaryText: z.string().trim().max(3000).default(""),
  headline: z.string().trim().max(200).default(""),
  description: z.string().trim().max(500).default(""),
});

export const decisionSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/, "Link inválido."),
    decision: z.enum(["aprovado", "ajustes"]),
    comment: z.string().trim().max(2000, "Use até 2000 caracteres.").default(""),
    name: z.string().trim().min(2, "Diga seu nome.").max(120),
  })
  .refine((v) => v.decision !== "ajustes" || v.comment.length >= 3, { path: ["comment"], message: "Descreva o que precisa mudar." });
