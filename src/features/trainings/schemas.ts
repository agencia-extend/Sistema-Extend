import { z } from "zod";
import { TRAINING_CATEGORIES } from "@/domain/trainings";

const uuid = z.uuid("Identificador inválido.");
const optionalText = (max: number, msg: string) => z.string().trim().max(max, msg).optional();

export const trainingSchema = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(2, "Dê um nome ao treinamento.").max(120, "Nome longo demais."),
  summary: optionalText(600, "Resumo longo demais (até 600 caracteres)."),
  category: z.enum(TRAINING_CATEGORIES, "Escolha a área."),
  isPublished: z.boolean(),
});
export type TrainingInput = z.infer<typeof trainingSchema>;

export const lessonSchema = z.object({
  id: uuid.optional(),
  trainingId: uuid,
  title: z.string().trim().min(2, "Dê um nome à aula.").max(160, "Nome longo demais."),
  body: optionalText(20000, "Texto longo demais (até 20 mil caracteres)."),
  videoUrl: z
    .string()
    .trim()
    .max(600, "Link longo demais.")
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Cole o link completo, começando com https://.")
    .optional(),
  durationMin: z.number().int().min(1, "Use de 1 a 600 minutos.").max(600, "Use de 1 a 600 minutos.").nullable(),
});
export type LessonInput = z.infer<typeof lessonSchema>;

export const assignSchema = z.object({
  trainingId: uuid,
  profileIds: z.array(uuid).min(1, "Escolha pelo menos uma pessoa.").max(200),
  dueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .nullable(),
});
export type AssignInput = z.infer<typeof assignSchema>;

export const idSchema = z.object({ id: uuid });
export const lessonRefSchema = z.object({ id: uuid, trainingId: uuid });
export const moveLessonSchema = z.object({ id: uuid, trainingId: uuid, dir: z.enum(["up", "down"]) });
export const doneSchema = z.object({ lessonId: uuid, trainingId: uuid, done: z.boolean() });
