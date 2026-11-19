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

export const tagSchema = z.object({
  id: z.uuid().nullable().optional(),
  name: z.string().trim().min(1, "Dê um nome à etiqueta.").max(40, "Até 40 caracteres."),
  color: z.enum(["azul", "verde", "amarelo", "vermelho", "roxo", "cinza"], "Escolha a cor."),
});
export const quickReplySchema = z.object({
  id: z.uuid().nullable().optional(),
  shortcut: z.string().trim().transform((s) => s.replace(/^\/+/, "").toLowerCase()).pipe(z.string().regex(/^[a-z0-9_-]{1,30}$/, "Atalho de 1 a 30 letras sem acento, números, - ou _ (ex.: preco).")),
  body: z.string().trim().min(1, "Escreva o texto da resposta.").max(4096, "Até 4.096 caracteres."),
});
export const radarSchema = z.object({ minutes: z.number().int().min(5, "No mínimo 5 minutos.").max(1440, "No máximo 24 horas (1.440 minutos).") });
export const conversationTagsSchema = z.object({ id: z.uuid("Conversa inválida."), tagIds: z.array(z.uuid()).max(20, "No máximo 20 etiquetas.") });
