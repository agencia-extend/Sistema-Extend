import "server-only";
import { z } from "zod";

// Segredos: só no servidor. Importar isto num Client Component quebra o build.
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
  JOBS_TOKEN: z.string().min(24).optional(),
  VAPID_PRIVATE_KEY: z.string().min(20).optional(),
});

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  cached ??= serverSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    JOBS_TOKEN: process.env.JOBS_TOKEN || undefined,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || undefined,
  });
  return cached;
}

export const hasSecretKey = () => Boolean(process.env.SUPABASE_SECRET_KEY);
