import Link from "next/link";
import type { ReactNode } from "react";
import { AuthBrand } from "@/components/app/auth-brand";

/**
 * Entrada do sistema: fundo branco e tudo ao centro. A marca da Extend se revela,
 * a linha dourada se estende a partir dela e o formulário sobe logo em seguida.
 * Fica sempre clara, mesmo com o aparelho no modo escuro.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-light relative isolate flex min-h-dvh flex-col overflow-hidden">
      <div className="auth-halo -z-10" aria-hidden="true" />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-14">
        <p className="sr-only">Agência Extend</p>
        <AuthBrand />
        <div className="auth-rise mt-12 w-full max-w-sm">{children}</div>
      </main>
      <footer className="auth-rise flex justify-center gap-5 px-6 pb-8 text-xs text-muted-foreground">
        <Link href="/privacidade" className="rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">Política de Privacidade</Link>
        <Link href="/termos" className="rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">Termos de uso</Link>
      </footer>
    </div>
  );
}
