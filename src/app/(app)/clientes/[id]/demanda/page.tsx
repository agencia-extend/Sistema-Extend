import { redirect } from "next/navigation";

/** A "Demanda do mês" virou o Controle de Mídias (docs/09). Links antigos continuam funcionando. */
export default async function DemandaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/clientes/${id}/midias`);
}
