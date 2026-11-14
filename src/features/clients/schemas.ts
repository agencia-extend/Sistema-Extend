import { z } from "zod";

const uuid = z.uuid("Identificador inválido.");
const optText = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`).optional().or(z.literal(""));
const optDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").optional().or(z.literal(""));
const cents = z.number().int().min(0).max(1e12).nullable().optional();

export const handoffSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do cliente.").max(120),
  legal_name: optText(160),
  document: optText(20),
  segment: optText(80),
  contact: z.object({ name: optText(120), phone: optText(30), email: optText(200), role: optText(80) }),
  services: z
    .array(z.object({ service_id: uuid, monthly_qty: z.number().int().min(0).max(200), price_cents: cents }))
    .min(1, "Escolha ao menos um serviço vendido."),
  monthly_fee_cents: cents,
  setup_fee_cents: cents,
  media_budget_cents: cents,
  payment_method: optText(80),
  contract_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de início."),
  contract_months: z.number().int().min(1, "Mínimo 1 mês.").max(120).nullable().optional(),
  communication_channel: optText(300),
  notes: optText(4000),
  promises: z.array(z.object({ description: z.string().trim().min(2, "Descreva a promessa.").max(300), due_at: z.string().min(10, "Informe o prazo.") })).max(20),
});

export const clientDataSchema = z.object({
  id: uuid,
  name: z.string().trim().min(2, "Informe o nome do cliente.").max(120),
  legal_name: optText(160),
  document: optText(20),
  segment: optText(80),
  contract_start: optDate,
  contract_end: optDate,
  renewal_date: optDate,
  media_budget_cents: cents,
  monthly_fee_cents: cents,
  payment_method: optText(80),
  communication_channel: optText(300),
  notes: optText(4000),
});

export const clientServiceSchema = z.object({
  clientId: uuid,
  serviceId: uuid,
  qty: z.number().int().min(0).max(200).nullable(),
  priceCents: cents,
});

export const statusSchema = z.object({ clientId: uuid, status: z.enum(["ativo", "pausado", "encerrado"]) });

export const memberSchema = z.object({ clientId: uuid, sectorId: uuid, profileId: uuid });

export const accountSchema = z.object({
  id: uuid.optional(),
  clientId: uuid,
  kind: z.enum(["bm", "ad_account_meta", "ad_account_google", "page", "instagram", "pixel", "whatsapp", "site", "drive_folder", "tiktok", "outro"]),
  value: z.string().trim().min(1, "Informe o valor.").max(300),
  label: optText(80),
});

export const contactSchema = z.object({
  id: uuid.optional(),
  clientId: uuid,
  name: z.string().trim().min(1, "Informe o nome.").max(120),
  role: optText(80),
  phone: optText(30),
  email: z.email("E-mail inválido.").optional().or(z.literal("")),
  is_primary: z.boolean().default(false),
});

export const promiseSchema = z.object({
  id: uuid.optional(),
  clientId: uuid,
  description: z.string().trim().min(2, "Descreva a promessa.").max(300),
  due_at: z.string().min(10, "Informe o prazo."),
});

export const answersSchema = z.object({
  clientId: uuid,
  answers: z.record(z.string().regex(/^[a-z0-9_]{1,60}$/), z.union([z.string().max(8000), z.array(z.string().max(200)).max(50), z.boolean(), z.null()])),
});

export const checklistItemSchema = z.object({
  id: uuid,
  done: z.boolean().optional(),
  assigneeId: uuid.nullable().optional(),
  dueAt: z.string().nullable().optional(),
});

export const newChecklistItemSchema = z.object({ clientId: uuid, title: z.string().trim().min(2, "Descreva o item.").max(160) });

export const meetingSchema = z.object({
  id: uuid.optional(),
  clientId: uuid,
  held_at: z.string().min(10, "Informe data e hora."),
  kind: z.enum(["briefing", "planejamento", "alinhamento", "resultados", "outro"]),
  title: z.string().trim().min(2, "Dê um título.").max(160),
  summary: optText(8000),
  link: z.url("Link inválido.").optional().or(z.literal("")),
  participant_ids: z.array(uuid).max(30).default([]),
});

export const ideaSchema = z.object({
  id: uuid.optional(),
  clientId: uuid,
  title: z.string().trim().min(2, "Dê um título.").max(160),
  body: optText(4000),
  link: z.url("Link inválido.").optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});

export const idSchema = z.object({ id: uuid });

export const taskStatusSchema = z.object({
  id: uuid,
  status: z.enum(["pendente", "em_andamento", "aguardando_aprovacao", "aprovado", "concluido", "cancelado"]),
});

export const importSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mode: z.enum(["ativo", "onboarding"]),
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120),
        segment: optText(160),
        document: optText(20),
        contract_start: z.string().nullable().optional(),
        contract_end: z.string().nullable().optional(),
        notes: optText(4000),
        services: z.array(z.object({ service_id: uuid, monthly_qty: z.number().int().min(0).max(200) })).max(20),
      }),
    )
    .min(1, "Nenhum cliente válido na planilha.")
    .max(1000, "No máximo 1.000 clientes por importação."),
});

export const serviceCatalogSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2, "Dê um nome ao serviço.").max(80),
  sector_id: uuid.nullable(),
  unit: z.enum(["videos", "artes", "posts", "gravacoes", "nenhuma"]),
  task_type: z.enum(["video", "design", "conteudo", "gravacao", "site", "criativo"]).nullable(),
  tabs: z.array(z.enum(["anuncios", "videos", "design", "conteudo", "gerenciamento", "gravacao", "site"])).max(7),
  is_active: z.boolean(),
});

export const checklistTemplateSchema = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(2, "Descreva o item.").max(160),
  default_sector_id: uuid.nullable(),
  due_days: z.number().int().min(0, "O prazo não pode ser negativo.").max(90, "Use até 90 dias."),
  day_kind: z.enum(["uteis", "corridos"]),
  milestone: z.enum(["abertura", "briefing", "combinados"]).nullable(),
  guidance: z.string().trim().max(1000, "Use até 1000 caracteres.").nullable().transform((v) => v || null),
  is_active: z.boolean(),
});

const questionSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{1,60}$/, "Chave inválida."),
  label: z.string().trim().min(2).max(200),
  type: z.enum(["text", "textarea", "select", "multiselect", "boolean", "url", "number"]),
  options: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  required: z.boolean(),
  visibility: z.enum(["full", "operational"]),
  help: z.string().max(300).optional(),
});

export const formSectionsSchema = z.object({
  sections: z
    .array(z.object({ key: z.string().regex(/^[a-z0-9_]{1,40}$/), title: z.string().trim().min(2).max(80), questions: z.array(questionSchema).min(1).max(40) }))
    .min(1)
    .max(20),
});

export type FormSection = z.infer<typeof formSectionsSchema>["sections"][number];
export type FormQuestion = z.infer<typeof questionSchema>;
