import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Entrada do sistema: à esquerda, o escritório da Extend à noite (a mesma
 * "noite" da barra lateral); à direita, só o formulário.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,1fr)]">
      <aside className="relative hidden overflow-hidden bg-night lg:block" aria-hidden="true">
        <Image src="/brand/escritorio.webp" alt="" fill priority sizes="55vw" className="object-cover opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-night/10" />
        <div className="absolute inset-x-0 bottom-0 grid gap-4 p-12 text-night-text">
          <span className="gold-rule block h-0.5 w-12 rounded-full" />
          <p className="max-w-md font-heading text-3xl leading-tight font-medium">
            O que está rodando, o que está travado e o que depende de cada setor, num lugar só.
          </p>
        </div>
      </aside>
      <main className="flex flex-col bg-background">
        <div className="flex items-center bg-night px-6 py-5 lg:bg-transparent lg:px-12 lg:pt-12">
          <Image src="/brand/logo.png" alt="Agência Extend" width={168} height={32} priority className="h-8 w-auto" />
        </div>
        <div className="flex flex-1 items-center px-6 py-10 lg:px-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
