import { z } from "zod";
import { REQUEST_KINDS, isValidCnpj } from "@/domain/privacy";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres.`)
    .transform((v) => v || null);

export const requestSchema = z.object({
  kind: z.enum(REQUEST_KINDS, { message: "Escolha o que você quer." }),
  details: z.string().trim().max(2000, "Use até 2000 caracteres.").optional().default(""),
});

export const answerSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(["em_andamento", "concluido", "recusado"], { message: "Escolha a situação." }),
    response: z.string().trim().max(2000, "Use até 2000 caracteres.").default(""),
  })
  .refine((v) => v.status === "em_andamento" || v.response.length >= 5, {
    path: ["response"],
    message: "Escreva a resposta para a pessoa (ela recebe o aviso com este texto).",
  });

export const controllerSchema = z.object({
  legalName: optional(160),
  cnpj: z
    .string()
    .trim()
    .refine((v) => !v || isValidCnpj(v), "CNPJ inválido. Confira os números.")
    .transform((v) => v || null),
  address: optional(300),
  dpoName: optional(120),
  dpoEmail: z
    .string()
    .trim()
    .refine((v) => !v || z.email().safeParse(v).success, "E-mail inválido.")
    .transform((v) => v || null),
});

export const consentSchema = z.object({ version: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
