import { z } from "zod";

export const syncNowSchema = z.object({ clientId: z.uuid("Cliente inválido.").nullable() });

export const reportNowSchema = z.object({ clientId: z.uuid("Cliente inválido."), period: z.enum(["hoje", "ontem", "7d", "30d", "mes", "semana"]) });
