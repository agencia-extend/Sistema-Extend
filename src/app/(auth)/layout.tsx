import Link from "next/link";
import type { ReactNode } from "react";
import { AuthBrand } from "@/components/app/auth-brand";
import { AuthBackdrop } from "@/components/app/auth-backdrop";
import { ThemeSwitch } from "@/components/app/theme-switch";

/**
 * Entrada do sistema: tudo ao centro, sobre um fundo vivo (linhas de luz que se estendem e
 * uma luz que segue o ponteiro). A marca se revela, a linha dourada se estende e o painel sobe.
 * Segue o tema escolhido (claro, escuro ou o do aparelho).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background">
      <AuthBackdrop />
      <header className="flex justify-end px-4 pt-4 sm:px-6 sm:pt-6">
        <ThemeSwitch />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-8">
        <p className="sr-only">Agência Extend</p>
        <AuthBrand />
        <div className="auth-rise auth-panel mt-10 w-full max-w-sm rounded-2xl border bg-card/80 p-6 shadow-[0_24px_60px_-28px_rgb(10_18_32_/_0.35)] backdrop-blur-md sm:p-7">
          {children}
        </div>
      </main>
      <footer className="auth-rise flex justify-center gap-5 px-6 pb-6 text-xs text-muted-foreground">
        <Link href="/privacidade" className="rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">Política de Privacidade</Link>
        <Link href="/termos" className="rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">Termos de uso</Link>
      </footer>
    </div>
  );
}
