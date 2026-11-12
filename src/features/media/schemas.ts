import { z } from "zod";
import { CONTENT_FORMATS, DESTINATIONS } from "@/domain/media";

const uuid = z.uuid("Identificador inválido.");
const link = z
  .string()
  .trim()
  .max(1000, "Link longo demais.")
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "O link precisa começar com http:// ou https://.");
const day = z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.");

/** Campos do conteúdo. Só o que for enviado é alterado (edição parcial pelo quadro ou pela tabela). */
export const contentSchema = z.object({
  taskId: uuid,
  title: z.string().trim().min(2, "Descreva o tema do conteúdo.").max(200, "Tema longo demais.").optional(),
  format: z.enum(CONTENT_FORMATS).or(z.literal("")).optional(),
  objective: z.string().trim().max(200, "Objetivo longo demais.").optional(),
  script: z.string().max(20000, "Roteiro longo demais.").optional(),
  caption: z.string().max(5000, "Legenda longa demais.").optional(),
  recorderId: uuid.nullable().optional(),
  recordingOn: day.optional(),
  editorId: uuid.nullable().optional(),
  finalUrl: link.optional(),
  rawUrl: link.optional(),
  postOn: day.optional(),
  postUrl: link.optional(),
  destination: z.array(z.enum(DESTINATIONS)).optional(),
  dueOn: day.optional(),
});

export type ContentInput = z.infer<typeof contentSchema>;
