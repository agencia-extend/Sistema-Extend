import { z } from "zod";

const uuid = z.uuid("Identificador inválido.");

export const serverSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .max(300, "Endereço longo demais.")
    .regex(/^https?:\/\/[^\s/]+(:\d+)?(\/\S*)?$/, "Informe o endereço completo, começando com https://")
    .transform((v) => v.replace(/\/+$/, "")),
  apiKey: z.string().trim().min(16, "Cole a chave completa do servidor (WAHA_API_KEY).").max(300, "Chave longa demais.").regex(/^\S+$/, "A chave não tem espaços."),
});

export const pairingSchema = z.object({ phone: z.string().trim().regex(/^\+?\d[\d\s()-]{9,18}$/, "Informe o número com DDD, ex.: 48 99999-0000.") });

export const groupSchema = z.object({ id: uuid, clientId: uuid.nullable(), alerts: z.boolean(), reports: z.boolean() });

export const testSchema = z.object({ groupId: uuid });
