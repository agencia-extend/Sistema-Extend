import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { NOTIFICATION_KINDS } from "@/domain/notifications/kinds";
import { formatRelative } from "@/domain/shared/dates";
import { PreferenceRow } from "./preference-row";
import { PushDevice } from "./push-device";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificacoesPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [prefsRes, devicesRes] = await Promise.all([
    supabase.from("notification_preferences").select("kind, in_app, push").eq("user_id", user.id),
    supabase.from("push_subscriptions").select("id, user_agent, created_at, last_used_at").order("created_at", { ascending: false }),
  ]);
  const prefs = new Map((prefsRes.data ?? []).map((p) => [p.kind as string, p as { in_app: boolean; push: boolean }]));
  const devices = (devicesRes.data ?? []) as { id: string; user_agent: string | null; created_at: string; last_used_at: string | null }[];

  return (
    <>
      <PageHeader title="Notificações" description="Escolha o que você quer receber no sino e no celular." />
      <PageBody className="grid max-w-3xl gap-10">
        <section aria-labelledby="aparelho" className="grid gap-3">
          <h2 id="aparelho" className="text-base font-semibold">
            Este aparelho
          </h2>
          <PushDevice vapidKey={publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} userId={user.id} />
          {devices.length > 0 && (
            <div className="grid gap-1 text-sm">
              <p className="text-muted-foreground">Aparelhos com notificação ativa ({devices.length})</p>
              <ul className="grid gap-1">
                {devices.map((d) => (
                  <li key={d.id} className="truncate">
                    {describeAgent(d.user_agent)} · ativado {formatRelative(d.created_at)}
                    {d.last_used_at && ` · último aviso ${formatRelative(d.last_used_at)}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section aria-labelledby="tipos" className="grid gap-3">
          <h2 id="tipos" className="text-base font-semibold">
            O que avisar
          </h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-2 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>Aviso</span>
              <span className="text-center">No sistema</span>
              <span className="text-center">No celular</span>
            </div>
            {NOTIFICATION_KINDS.map((k) => {
              const p = prefs.get(k.key);
              return <PreferenceRow key={k.key} kind={k.key} label={k.label} inApp={p?.in_app ?? true} push={p?.push ?? true} />;
            })}
          </div>
        </section>
      </PageBody>
    </>
  );
}

function describeAgent(ua: string | null) {
  if (!ua) return "Aparelho";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : "Aparelho";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return [os, browser].filter(Boolean).join(" · ");
}
