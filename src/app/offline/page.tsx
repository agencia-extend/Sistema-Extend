import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Sem conexão" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-night px-6 text-night-text">
      <div className="grid max-w-sm gap-4 text-center">
        <WifiOff className="mx-auto size-8 text-night-dim" aria-hidden="true" />
        <h1 className="text-2xl font-semibold">Você está sem internet</h1>
        <p className="text-sm text-night-dim">
          O sistema precisa de conexão para mostrar dados atualizados. Assim que a internet voltar, recarregue a página.
        </p>
      </div>
    </main>
  );
}
