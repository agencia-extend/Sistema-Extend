import { z } from "zod";

const uuid = z.uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const link = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => !v || /^https?:\/\//.test(v), "O link precisa começar com https://");

export const postSchema = z.object({
  clientId: uuid,
  taskId: uuid,
  postOn: day.or(z.literal("")),
  caption: z.string().max(5000, "Legenda longa demais.").default(""),
  postUrl: link.default(""),
});

export const recordingSchema = z.object({
  id: uuid.optional(),
  clientId: uuid,
  recordedOn: day,
  location: z.string().trim().max(200, "Use até 200 caracteres.").default(""),
  rawUrl: link.default(""),
  notes: z.string().trim().max(2000, "Use até 2000 caracteres.").default(""),
  people: z.array(uuid).min(1, "Marque quem gravou.").max(20),
  tasks: z.array(uuid).max(60),
});
