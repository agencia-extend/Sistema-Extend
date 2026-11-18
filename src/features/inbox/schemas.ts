import { z } from "zod";
import { REPLY_MAX } from "@/domain/inbox";

/** Resposta pelo número da Extend (Zod no navegador e no servidor). */
export const replySchema = z.object({ id: z.uuid("Conversa inválida."), text: z.string().trim().min(1, "Escreva a mensagem.").max(REPLY_MAX, "Até 4.096 caracteres.") });

export const leadNameSchema = z.string().trim().min(2, "Informe o nome do lead.").max(120, "Até 120 caracteres.");
