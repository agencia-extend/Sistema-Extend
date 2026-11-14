import { z } from "zod";
import { CREATIVE_FORMATS, CREATIVE_OBJECTIVES } from "@/domain/creatives";
import { MARKETING_KINDS } from "@/domain/marketing";

const req = (label: string, max: number) => z.string().trim().min(2, `Informe ${label}.`).max(max, `Use até ${max} caracteres.`);

/** Briefing do criativo que sai sozinho antes da data (mesmos campos do pedido de criativo). */
export const briefSchema = z.object({
  format: z.enum(CREATIVE_FORMATS, { message: "Escolha o formato." }),
  objective: z.enum(CREATIVE_OBJECTIVES, { message: "Escolha o objetivo." }),
  quantity: z.number({ message: "Informe a quantidade." }).int().min(1, "Peça ao menos 1.").max(50, "Até 50 por pedido."),
  angle: req("o ângulo ou a mensagem", 300),
  audience: req("o público", 300),
  cta: req("a chamada (CTA)", 120),
  priority: z.enum(["baixa", "media", "alta", "urgente"], { message: "Escolha a prioridade." }),
  notes: z.string().trim().max(2000, "Use até 2000 caracteres.").default(""),
});
export type BriefInput = z.infer<typeof briefSchema>;

export const marketingDateSchema = z.object({
  id: z.uuid().optional(),
  clientId: z.uuid({ message: "Escolha o cliente." }),
  title: z.string().trim().min(2, "Dê um nome à data.").max(120, "Use até 120 caracteres."),
  onDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
  kind: z.enum(MARKETING_KINDS, { message: "Escolha o tipo." }),
  notes: z.string().trim().max(2000, "Use até 2000 caracteres.").default(""),
  leadDays: z.number({ message: "Informe a antecedência." }).int().min(1, "Mínimo de 1 dia.").max(90, "Até 90 dias."),
  brief: briefSchema.nullable(),
});
export type MarketingDateInput = z.infer<typeof marketingDateSchema>;
