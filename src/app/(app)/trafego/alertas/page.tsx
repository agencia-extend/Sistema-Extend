import { redirect } from "next/navigation";

/** Os alertas agora ficam no módulo Anúncios (avisos já enviados apontam para cá). */
export default async function AlertasAntigoPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const { situacao } = await searchParams;
  redirect(situacao ? `/anuncios/alertas?situacao=${encodeURIComponent(situacao)}` : "/anuncios/alertas");
}
