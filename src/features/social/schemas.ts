import { z } from "zod";

/** Liga (ou desliga, clientId null) a página ou o Instagram a um cliente. */
export const socialProfileSchema = z.object({ id: z.uuid("Página inválida."), clientId: z.uuid("Cliente inválido.").nullable() });

/** Atualizar agora: de um cliente (aba Redes sociais) ou tudo (Integrações). */
export const refreshSocialSchema = z.object({ clientId: z.uuid("Cliente inválido.").nullable() });
