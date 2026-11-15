import { z } from "zod";

const uuid = z.uuid("Identificador inválido.");

export const systemTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .min(50, "Cole o token completo gerado no BM (ele é bem longo).")
    .max(1000, "Esse texto é longo demais para um token.")
    .regex(/^[A-Za-z0-9_|-]+$/, "O token tem só letras e números. Confira se não copiou espaço ou outro texto junto."),
});

export const connectionIdSchema = z.object({ connectionId: uuid });

export const adAccountSchema = z.object({
  id: uuid,
  enabled: z.boolean(),
  clientId: uuid.nullable(),
});
