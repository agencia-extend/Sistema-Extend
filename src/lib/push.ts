import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

export type PushPayload = { title: string; body?: string | null; href?: string | null; tag?: string };
type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

export function pushConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

// O padrão VAPID exige um contato https ou mailto.
const subject = () =>
  publicEnv.NEXT_PUBLIC_SITE_URL.startsWith("https://") ? publicEnv.NEXT_PUBLIC_SITE_URL : "mailto:contato@agenciaextend.com.br";

/**
 * Envia para os aparelhos de cada usuário e remove inscrições que deixaram de existir.
 * Retorna, por mensagem, se foi entregue a pelo menos um aparelho.
 */
export async function sendPush(messages: { key: string; userId: string; payload: PushPayload }[]) {
  const result = { sent: [] as string[], skipped: [] as string[], failed: [] as string[] };
  if (!messages.length) return result;
  if (!pushConfigured()) {
    result.skipped.push(...messages.map((m) => m.key));
    return result;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", [...new Set(messages.map((m) => m.userId))]);
  if (error) throw error;

  const vapidDetails = {
    subject: subject(),
    publicKey: publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    privateKey: serverEnv().VAPID_PRIVATE_KEY!,
  };
  const byUser = new Map<string, Subscription[]>();
  for (const s of (data ?? []) as Subscription[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  const gone: string[] = [];
  const used: string[] = [];
  await Promise.all(
    messages.map(async ({ key, userId, payload }) => {
      const subs = byUser.get(userId) ?? [];
      if (!subs.length) {
        result.skipped.push(key);
        return;
      }
      let delivered = false;
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify(payload),
              { vapidDetails, TTL: 6 * 3600 },
            );
            delivered = true;
            used.push(s.id);
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) gone.push(s.id);
            else console.error("[push] falha no envio", status ?? "erro");
          }
        }),
      );
      (delivered ? result.sent : result.failed).push(key);
    }),
  );
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  if (used.length) await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("id", used);
  return result;
}
