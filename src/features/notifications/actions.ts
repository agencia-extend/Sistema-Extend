"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, must } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok } from "@/domain/shared/result";
import { NOTIFICATION_KINDS } from "@/domain/notifications/kinds";

export const markNotificationRead = defineAction({ schema: z.object({ id: z.uuid() }) }, async ({ id }, { user }) => {
  const supabase = await createClient();
  must(await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).is("read_at", null));
  return ok(null);
});

export const markAllNotificationsRead = defineAction({ schema: z.object({}) }, async () => {
  const supabase = await createClient();
  const count = must(await supabase.rpc("mark_all_notifications_read")) as number;
  return ok({ count }, count ? "Tudo marcado como lido." : "Não há notificações novas.");
});

const kinds = NOTIFICATION_KINDS.map((k) => k.key) as [string, ...string[]];

export const setNotificationPreference = defineAction(
  { schema: z.object({ kind: z.enum(kinds), inApp: z.boolean(), push: z.boolean() }) },
  async ({ kind, inApp, push }, { user }) => {
    const supabase = await createClient();
    must(
      await supabase
        .from("notification_preferences")
        .upsert({ user_id: user.id, kind, in_app: inApp, push: inApp && push, updated_at: new Date().toISOString() }),
    );
    revalidatePath("/configuracoes/notificacoes");
    return ok(null, "Preferência salva.");
  },
);

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://", "Endereço de notificação inválido."),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(10).max(100) }),
  userAgent: z.string().max(400).optional(),
});

export const savePushSubscription = defineAction({ schema: subscriptionSchema }, async ({ endpoint, keys, userAgent }, { user }) => {
  const supabase = await createClient();
  // O mesmo aparelho pode ter sido usado por outra pessoa: a inscrição passa a ser de quem está logado.
  // (a RLS não deixa apagar a linha de outra pessoa; por isso a chave secreta aqui).
  if (process.env.SUPABASE_SECRET_KEY) {
    await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint).neq("user_id", user.id);
  }
  must(
    await supabase
      .from("push_subscriptions")
      .upsert({ user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: userAgent ?? null }, { onConflict: "endpoint" }),
  );
  revalidatePath("/configuracoes/notificacoes");
  return ok(null, "Notificações ativadas neste aparelho.");
});

export const removePushSubscription = defineAction({ schema: z.object({ endpoint: z.url() }) }, async ({ endpoint }, { user }) => {
  const supabase = await createClient();
  must(await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id));
  revalidatePath("/configuracoes/notificacoes");
  return ok(null, "Notificações desativadas neste aparelho.");
});
