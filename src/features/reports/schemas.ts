import { z } from "zod";
import { FEEDBACKS, REPORT_AREAS } from "@/domain/reports";

export const reportSchema = z.object({
  id: z.uuid().optional(),
  clientId: z.uuid(),
  area: z.enum(REPORT_AREAS, { message: "Escolha a área." }),
  sentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do envio."),
  link: z
    .string()
    .trim()
    .max(500, "Use até 500 caracteres.")
    .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "Cole o link completo, começando com https://.")
    .default(""),
  notes: z.string().trim().max(1000, "Use até 1000 caracteres.").default(""),
});
export type ReportInput = z.infer<typeof reportSchema>;

export const feedbackSchema = z
  .object({
    id: z.uuid(),
    clientId: z.uuid(),
    feedback: z.enum(FEEDBACKS, { message: "Escolha o retorno do cliente." }),
    feedbackNote: z.string().trim().max(1000, "Use até 1000 caracteres.").default(""),
  })
  .refine((v) => v.feedback !== "negativo" || v.feedbackNote.length >= 3, { path: ["feedbackNote"], message: "Conte o que o cliente achou ruim." });
export type FeedbackInput = z.infer<typeof feedbackSchema>;
