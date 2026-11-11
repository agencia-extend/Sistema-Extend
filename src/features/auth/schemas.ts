import { z } from "zod";

const email = z.email("Informe um e-mail válido.").trim().toLowerCase().max(200);

export const passwordSchema = z
  .string()
  .min(8, "Use pelo menos 8 caracteres.")
  .max(72, "Use no máximo 72 caracteres.")
  .regex(/[A-Za-z]/, "Inclua ao menos uma letra.")
  .regex(/[0-9]/, "Inclua ao menos um número.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha.").max(72),
  remember: z.boolean().default(true),
  next: z.string().optional(),
});

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem." });

export const acceptInvitationSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/, "Convite inválido."),
  fullName: z.string().trim().min(2, "Informe seu nome.").max(120),
  password: passwordSchema,
});
