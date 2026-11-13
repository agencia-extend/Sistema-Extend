import { z } from "zod";

const uuid = z.uuid("Identificador inválido.");

export const routineSchema = z.object({
  id: uuid.optional(),
  serviceId: uuid,
  title: z.string().trim().min(2, "Dê um nome à rotina.").max(120, "Nome longo demais."),
  description: z.string().trim().max(2000, "Descrição longa demais.").optional(),
  sectorId: uuid,
  weekday: z.number().int().min(0).max(6),
  dueHour: z.number().int().min(0).max(23),
  leadDays: z.number().int().min(0, "Use de 0 a 6 dias.").max(6, "Use de 0 a 6 dias."),
  isActive: z.boolean(),
});
export type RoutineInput = z.infer<typeof routineSchema>;

export const templateSchema = z
  .object({
    id: uuid.optional(),
    name: z.string().trim().min(2, "Dê um nome ao modelo.").max(120, "Nome longo demais."),
    category: z.enum(["criativos", "trafego", "conteudo", "site", "copy", "reunioes", "outros"]),
    type: z.enum(["video", "design", "conteudo", "gravacao", "site", "geral"]),
    description: z.string().trim().max(4000, "Descrição longa demais.").optional(),
    dueDays: z.number().int().min(0, "Use de 0 a 365 dias.").max(365, "Use de 0 a 365 dias."),
    priority: z.enum(["baixa", "media", "alta", "urgente"]),
    repeat: z.object({ unit: z.enum(["dia", "semana", "mes"]), every: z.number().int().min(1).max(52) }).nullable(),
    isActive: z.boolean(),
  });
export type TemplateInput = z.infer<typeof templateSchema>;

export const idSchema = z.object({ id: uuid });
