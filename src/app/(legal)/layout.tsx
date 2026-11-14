import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LegalNav } from "./legal-nav";
import { CookieNotice } from "@/components/app/cookie-notice";

/** Páginas legais públicas: abrem sem login (link no rodapé do login, nos e-mails e no sistema). */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/inicio" aria-label="Agência Extend: voltar ao sistema" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Image src="/brand/logo.png" alt="Agência Extend" width={150} height={28} className="h-7 w-auto" priority />
          </Link>
          <LegalNav />
        </div>
        <span className="gold-rule block h-0.5" aria-hidden="true" />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">{children}</main>
      <div className="px-4 pb-6"><CookieNotice /></div>
    </div>
  );
}
