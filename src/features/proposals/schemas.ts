import { z } from "zod";
import { BLOCK_TYPES, RECURRENCES, unknownVariables } from "@/domain/proposals";
import { normalizeEmail, normalizePhone } from "@/domain/crm";

const uuid = z.uuid();
const cents = z.number().int().min(0, "Use um valor positivo.").max(100_000_000_00, "Valor alto demais.");
const known = (v: string) => unknownVariables(v).length === 0;
const unknownMsg = "Há uma variável que não existe. Use as da lista (ex.: {cliente}).";

export const blockSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,40}$/i),
  type: z.enum(BLOCK_TYPES),
  title: z.string().trim().max(120, "Use até 120 caracteres.").refine(known, unknownMsg),
  body: z.string().max(6000, "Use até 6000 caracteres.").refine(known, unknownMsg),
  imagePath: z.string().regex(/^modelos\/[a-z0-9-]+\.(png|jpe?g)$/i).nullable().optional(),
});

export const templateSchema = z
  .object({
    id: uuid.optional(),
    name: z.string().trim().min(2, "Dê um nome ao modelo.").max(80, "Use até 80 caracteres."),
    blocks: z.array(blockSchema).min(1, "O modelo precisa de ao menos um bloco.").max(30, "Use até 30 blocos."),
    whatsappMessage: z
      .string()
      .trim()
      .min(10, "Escreva a mensagem do WhatsApp.")
      .max(1000, "Use até 1000 caracteres.")
      .refine((v) => v.includes("{link}"), "A mensagem precisa ter {link} para o cliente abrir a proposta.")
      .refine(known, unknownMsg),
    validityDays: z.number().int().min(1, "Mínimo de 1 dia.").max(90, "Máximo de 90 dias."),
  })
  .refine((v) => v.blocks.some((b) => b.type === "investimento"), { message: "Mantenha o bloco Investimento: é onde aparecem os valores.", path: ["blocks"] });
export type TemplateInput = z.input<typeof templateSchema>;

export const offerSchema = z.object({
  serviceId: uuid,
  description: z.string().trim().max(1000, "Use até 1000 caracteres."),
  priceCents: cents.nullable(),
  recurrence: z.enum(RECURRENCES),
});

export const itemSchema = z
  .object({
    serviceId: uuid.nullable(),
    name: z.string().trim().min(2, "Dê um nome ao serviço.").max(120, "Use até 120 caracteres."),
    description: z.string().trim().max(1000, "Use até 1000 caracteres."),
    priceCents: cents,
    discountCents: cents,
    quantity: z.number().int().min(1, "Quantidade mínima: 1.").max(999),
    recurrence: z.enum(RECURRENCES),
  })
  .refine((i) => i.discountCents <= i.priceCents * i.quantity, { message: "O desconto não pode passar do valor.", path: ["discountCents"] });

export const proposalSchema = z.object({
  id: uuid.optional(),
  leadId: uuid,
  templateId: uuid,
  clientName: z.string().trim().min(2, "Informe o nome do cliente.").max(160, "Use até 160 caracteres."),
  contactName: z.string().trim().max(120, "Use até 120 caracteres."),
  contactPhone: z.string().trim().max(30).refine((v) => !v || normalizePhone(v), "Telefone com DDD, ex.: (51) 99999-0000."),
  contactEmail: z.string().trim().max(200).refine((v) => !v || normalizeEmail(v), "E-mail inválido."),
  items: z.array(itemSchema).min(1, "Escolha ao menos um serviço.").max(30, "Use até 30 serviços."),
  paymentTerms: z.string().trim().max(300, "Use até 300 caracteres."),
  notes: z.string().trim().max(4000, "Use até 4000 caracteres."),
  validUntil: z.iso.date("Escolha a validade."),
});
export type ProposalInput = z.input<typeof proposalSchema>;

export const refuseSchema = z.object({ id: uuid, reason: z.string().trim().min(3, "Informe o motivo da recusa.").max(300, "Use até 300 caracteres.") });

export const acceptSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{30,40}$/),
  name: z.string().trim().min(3, "Escreva seu nome completo.").max(120, "Use até 120 caracteres."),
  confirm: z.literal(true, "Confirme que leu e aceita a proposta."),
});
