import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="grid max-w-sm gap-3 text-center">
        <h1 className="text-2xl font-semibold">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground">O endereço pode estar errado ou o item foi removido.</p>
        <Link href="/inicio" className="text-sm font-medium text-primary hover:underline">
          Voltar para o início
        </Link>
      </div>
    </main>
  );
}
