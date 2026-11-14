import { z } from "zod";
import { ACTIVITY_KINDS, LEAD_SOURCES, normalizeEmail, normalizePhone } from "@/domain/crm";

const uuid = z.uuid();
const opt = (max: number) => z.string().trim().max(max, `Use até ${max} caracteres.`).default("");
const cents = z.number().int().min(0, "Use um valor positivo.").max(100_000_000_00).nullable();

export const leadSchema = z
  .object({
    id: uuid.optional(),
    pipelineId: uuid,
    stageId: uuid,
    name: z.string().trim().min(2, "Informe o nome do contato.").max(120, "Use até 120 caracteres."),
    company: opt(160),
    phone: opt(30).refine((v) => !v || normalizePhone(v), "Telefone com DDD, ex.: (51) 99999-0000."),
    email: opt(200).refine((v) => !v || normalizeEmail(v), "E-mail inválido."),
    source: z.enum(LEAD_SOURCES),
    utmSource: opt(200),
    utmMedium: opt(200),
    utmCampaign: opt(200),
    utmContent: opt(200),
    utmTerm: opt(200),
    valueCents: cents,
    ownerId: uuid.nullable(),
    notes: opt(4000),
  })
  .refine((v) => v.phone || v.email, { message: "Informe telefone ou e-mail para não perder o contato.", path: ["phone"] });
export type LeadInput = z.input<typeof leadSchema>;

export const moveLeadSchema = z.object({ id: uuid, stageId: uuid, reason: z.string().trim().max(500, "Use até 500 caracteres.").default("") });

export const activitySchema = z.object({
  leadId: uuid,
  kind: z.enum(ACTIVITY_KINDS),
  body: z.string().trim().min(1, "Escreva o que aconteceu ou o que fazer.").max(2000, "Use até 2000 caracteres."),
  dueAt: z.iso.datetime({ offset: true, message: "Data inválida." }).nullable(),
});

export const activityDoneSchema = z.object({ id: uuid, leadId: uuid, done: z.boolean() });

export const leadImportSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  pipelineId: uuid,
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120),
        company: z.string().max(160),
        phone: z.string().regex(/^\d{10,15}$/).nullable(),
        email: z.string().max(200).nullable(),
        source: z.enum(LEAD_SOURCES),
        value_cents: z.number().int().min(0).nullable(),
        notes: z.string().max(4000),
      }),
    )
    .min(1, "A planilha não tem leads válidos.")
    .max(2000, "Importe até 2.000 leads por vez."),
});

export const pipelineSchema = z.object({ id: uuid.optional(), name: z.string().trim().min(2, "Dê um nome ao funil.").max(80, "Use até 80 caracteres.") });

export const stageSchema = z.object({
  id: uuid.optional(),
  pipelineId: uuid,
  name: z.string().trim().min(1, "Dê um nome à etapa.").max(60, "Use até 60 caracteres."),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida."),
  slaDays: z.number().int("Use um número inteiro.").min(1, "Use de 1 a 180 dias.").max(180, "Use de 1 a 180 dias.").nullable(),
});

export const moveStageSchema = z.object({ id: uuid, pipelineId: uuid, direction: z.enum(["up", "down"]) });
