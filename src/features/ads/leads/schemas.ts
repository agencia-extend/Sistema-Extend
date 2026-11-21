import { z } from "zod";
import { LEAD_QUALITIES } from "@/domain/ads/client-leads";

// Leads das campanhas dos clientes (RF-T2-01).
const uuid = z.uuid();
const opt = (max: number) => z.string().trim().max(max).nullable();

export const clientLeadRowSchema = z
  .object({
    external_key: z.string().trim().min(1).max(200),
    name: opt(200),
    phone: z.string().regex(/^\d{12,15}$/).nullable(),
    email: z.email().max(200).nullable(),
    lead_at: z.iso.datetime({ offset: true }),
    campaign_ext_id: opt(64),
    campaign_name: opt(300),
    ad_name: opt(300),
    form_name: opt(300),
  })
  .refine((r) => r.name || r.phone || r.email, "Cada lead precisa de nome, telefone ou e-mail.");

export const importClientLeadsSchema = z.object({
  clientId: uuid,
  rows: z.array(clientLeadRowSchema).min(1, "Nenhum lead válido na planilha.").max(5000, "Importe até 5.000 leads por vez."),
});

export const rateLeadSchema = z.object({
  id: uuid,
  clientId: uuid,
  quality: z.enum(LEAD_QUALITIES).nullable(),
  note: z.string().trim().max(1000, "Use até 1.000 caracteres.").default(""),
});

export const publicRateSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/, "Link inválido."),
  leadId: uuid,
  quality: z.enum(LEAD_QUALITIES).nullable(),
  note: z.string().trim().max(1000, "Use até 1.000 caracteres.").default(""),
  name: z.string().trim().min(2, "Diga seu nome.").max(120),
});
