import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMotion } from "@/components/app/brand-motion";

/**
 * Entrada do sistema: à esquerda, a "noite" da barra lateral com a marca da Extend
 * em movimento (o "ae" se revela e a luz se estende a partir dele); à direita, só o
 * formulário. No celular, a marca animada fica pequena no topo.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,1fr)]">
      <aside className="relative hidden overflow-hidden bg-night lg:flex lg:flex-col lg:justify-between" aria-label="Agência Extend">
        <div className="auth-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative flex flex-1 items-center px-12 xl:px-16">
          <BrandMotion size="lg" />
        </div>
        <div className="relative grid gap-4 p-12 text-night-text xl:px-16">
          <span className="gold-rule block h-0.5 w-12 rounded-full" aria-hidden="true" />
          <p className="max-w-md font-heading text-3xl leading-tight font-medium">
            O que está rodando, o que está travado e o que depende de cada setor, num lugar só.
          </p>
        </div>
      </aside>
      <main className="flex flex-col bg-background">
        <div className="flex items-center gap-4 bg-night px-6 py-5 lg:bg-transparent lg:px-12 lg:pt-12">
          <div className="w-28 lg:hidden">
            <BrandMotion size="sm" />
          </div>
          <Image src="/brand/logo.png" alt="Agência Extend" width={168} height={32} priority className="hidden h-8 w-auto lg:block" />
          <span className="sr-only lg:hidden">Agência Extend</span>
        </div>
        <div className="flex flex-1 items-center px-6 py-10 lg:px-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <footer className="flex flex-wrap gap-x-4 gap-y-1 px-6 pb-6 text-xs text-muted-foreground lg:px-12">
          <Link href="/privacidade" className="hover:text-foreground hover:underline">Política de Privacidade</Link>
          <Link href="/termos" className="hover:text-foreground hover:underline">Termos de uso</Link>
        </footer>
      </main>
    </div>
  );
}
