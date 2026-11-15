import "server-only";
import { missingEnv, type Provider } from "@/domain/integrations";
import { publicEnv } from "@/lib/env";

// Valores colados no painel da Vercel às vezes vêm com espaço, quebra de linha ou aspas.
export const env = (name: string) => (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "");

export const missing = (provider: Provider) => missingEnv(provider, process.env);
export const configured = (provider: Provider) => missing(provider).length === 0;

/** Endereço de retorno do OAuth, igual ao cadastrado no app da Meta e no cliente OAuth do Google. */
export const redirectUri = (provider: Provider) => `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/integracoes/${provider}/retorno`;
