import { redirect } from "next/navigation";

/** Endereço antigo (avisos já enviados): a conversa abre na tela do atendimento. */
export default async function ConversaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(/^[0-9a-f-]{36}$/i.test(id) ? `/atendimento?conversa=${id}` : "/atendimento");
}
