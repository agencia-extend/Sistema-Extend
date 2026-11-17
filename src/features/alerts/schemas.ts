import { z } from "zod";

export const ackAlertSchema = z.object({ id: z.uuid("Alerta inválido.") });

export const resolveAlertSchema = z.object({
  id: z.uuid("Alerta inválido."),
  note: z.string().trim().min(3, "Conte em poucas palavras como foi resolvido.").max(500, "Até 500 caracteres."),
});
