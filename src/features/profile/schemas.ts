import { z } from "zod";
import { passwordSchema } from "@/features/auth/schemas";

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome.").max(120),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()-]/g, ""))
    .refine((v) => v === "" || /^\+?[1-9]\d{9,14}$/.test(v), "Use DDD + número, ex.: 41 99999-0000.")
    .transform((v) => (v === "" ? null : v.startsWith("+") ? v : `+55${v}`)),
});

export const changePasswordSchema = z
  .object({ current: z.string().min(1, "Informe a senha atual."), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem." });
