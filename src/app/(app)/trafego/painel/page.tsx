import { redirect } from "next/navigation";

/** O painel do tráfego virou o módulo Anúncios (como no HubSystem). */
export default async function PainelTrafegoPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { periodo } = await searchParams;
  redirect(periodo ? `/anuncios/clientes?periodo=${encodeURIComponent(periodo)}` : "/anuncios/clientes");
}
