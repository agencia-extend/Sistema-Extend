"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/app/form-field";
import { removePushSubscription, savePushSubscription } from "@/features/notifications/actions";
import { sendTestNotification } from "@/features/admin/actions";
import { handleResult } from "@/lib/action-feedback";

type Status = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Ativa/desativa o Web Push neste aparelho e envia um teste. */
export function PushDevice({
  vapidKey,
  userId,
  offHint = "Ative para receber demandas e alertas no celular.",
  appName = "o Extend",
}: {
  vapidKey: string | null;
  userId: string;
  offHint?: string;
  appName?: string;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setStatus(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  const enable = () =>
    startTransition(async () => {
      if (!vapidKey) return;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setStatus(perm === "denied" ? "denied" : "off");
      try {
        const reg = await registration();
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) }));
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        if (handleResult(await savePushSubscription({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent }))) setStatus("on");
      } catch {
        handleResult({ ok: false, code: "unknown", message: "Não foi possível ativar neste navegador. Tente pelo app instalado ou outro navegador." });
      }
    });

  const disable = () =>
    startTransition(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setStatus("off");
    });

  const test = () => startTransition(async () => void handleResult(await sendTestNotification({ userId })));

  if (!vapidKey) {
    return <FormAlert tone="info">As notificações no celular ainda não foram configuradas no servidor (chaves VAPID). Avise o responsável técnico.</FormAlert>;
  }
  if (status === "checking") return <p className="text-sm text-muted-foreground">Verificando este aparelho…</p>;
  if (status === "ios-install") {
    return (
      <FormAlert tone="info">
        No iPhone, as notificações só funcionam com o app instalado: toque em Compartilhar → “Adicionar à Tela de Início”, abra {appName} por
        lá e volte a esta página.
      </FormAlert>
    );
  }
  if (status === "unsupported") return <FormAlert tone="info">Este navegador não aceita notificações. Use o Chrome, Edge ou o app instalado.</FormAlert>;
  if (status === "denied") {
    return (
      <FormAlert tone="danger">
        As notificações foram bloqueadas neste navegador. Libere em Configurações do navegador → Notificações → este site, e recarregue a página.
      </FormAlert>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
      <div className="grid flex-1 gap-0.5">
        <p className="text-sm font-medium">{status === "on" ? "Notificações ativas neste aparelho" : "Notificações desligadas neste aparelho"}</p>
        <p className="text-sm text-muted-foreground">
          {status === "on" ? "Você recebe avisos mesmo com o sistema fechado." : offHint}
        </p>
      </div>
      {status === "on" ? (
        <>
          <Button variant="outline" onClick={test} disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />} Enviar teste
          </Button>
          <Button variant="ghost" onClick={disable} disabled={pending}>
            <BellOff aria-hidden="true" /> Desativar
          </Button>
        </>
      ) : (
        <Button onClick={enable} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <BellRing aria-hidden="true" />} Ativar notificações
        </Button>
      )}
    </div>
  );
}
