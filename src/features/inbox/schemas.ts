import { z } from "zod";
import { REPLY_MAX } from "@/domain/inbox";

/** Resposta pelo número da Extend (Zod no navegador e no servidor). */
export const replySchema = z.object({ id: z.uuid("Conversa inválida."), text: z.string().trim().min(1, "Escreva a mensagem.").max(REPLY_MAX, "Até 4.096 caracteres.") });

export const leadNameSchema = z.string().trim().min(2, "Informe o nome do lead.").max(120, "Até 120 caracteres.");

/** Arquivo anexado: o tipo e o tamanho são conferidos de novo no servidor (checkOutgoingMedia). */
export const prepareMediaSchema = z.object({ id: z.uuid("Conversa inválida."), mime: z.string().trim().min(1).max(120), size: z.number().int().nonnegative() });

export const sendMediaSchema = z.object({
  id: z.uuid("Conversa inválida."),
  path: z.string().max(200),
  mime: z.string().trim().min(1).max(120),
  size: z.number().int().nonnegative(),
  name: z.string().trim().min(1, "Arquivo sem nome.").max(200),
  caption: z.string().trim().max(1024, "Legenda de até 1.024 caracteres.").default(""),
});
