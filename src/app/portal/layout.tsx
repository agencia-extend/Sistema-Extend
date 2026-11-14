import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, LogOut } from "lucide-react";
import { requirePortal } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { portalHome, touchLastSeen } from "@/features/portal/queries";
import { PortalNav } from "@/features/portal/components/portal-nav";
import { NotificationBell } from "@/features/notifications/components/notification-bell";

export const metadata: Metadata = { title: { template: "%s · Área do cliente", default: "Área do cliente" }, robots: { index: false, follow: false } };

/** Área do cliente (RF-ACL-02): layout próprio, simples e para o celular. */
export default async function PortalLayout({ children }: { children: ReactNode }) {
  const { user, clientId, preview } = await requirePortal();
  const supabase = await createClient();
  const [home, { count }] = await Promise.all([
    portalHome(clientId),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    preview ? Promise.resolve() : touchLastSeen(user.id),
  ]);

  return (
    <div className="min-h-dvh bg-background">
      <a href="#conteudo" className="sr-only z-50 rounded bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      {preview && (
        <div role="note" className="bg-warning-soft text-warning">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
            <Eye className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">Prévia: você está vendo o que a pessoa do cliente vê. Aprovar fica só com o cliente.</span>
            <Link href="/portal/previa/sair" prefetch={false} className="font-medium underline underline-offset-2">Sair da prévia</Link>
          </div>
        </div>
      )}
      <header className="bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/portal" className="shrink-0" aria-label="Área do cliente: início">
            <Image src="/brand/logo.png" alt="Agência Extend" width={130} height={25} className="h-6 w-auto" priority />
          </Link>
          <span className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
          <p className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">{home.client.name}</p>
          <div className="ml-auto flex items-center gap-1">
            {!preview && (
              <NotificationBell
                userId={user.id}
                initialUnread={count ?? 0}
                settingsHref="/portal/ajuda#avisos"
                emptyText="Nada por aqui. Quando houver conteúdo para aprovar ou relatório novo, aparece aqui."
              />
            )}
            {!preview && (
              <Link href="/sair" prefetch={false} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                <LogOut className="size-4" aria-hidden="true" /> Sair
              </Link>
            )}
          </div>
        </div>
        <span className="gold-rule block h-0.5" aria-hidden="true" />
      </header>
      <PortalNav pending={home.pending_approvals} />
      <main id="conteudo" className="mx-auto grid max-w-5xl gap-6 px-4 pt-6 pb-16">
        {children}
      </main>
    </div>
  );
}
