import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { FormAlert } from "@/components/app/form-field";
import { getProposal, listOffers, listTemplates } from "@/features/proposals/queries";
import { draftFromProposal } from "@/features/proposals/defaults";
import { signBlockImages } from "@/features/proposals/server";
import { ProposalEditor } from "@/features/proposals/components/proposal-editor";

export const metadata: Metadata = { title: "Editar proposta" };

export default async function EditarPropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([requirePermission("proposals.manage"), params]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p, templates, offers] = await Promise.all([getProposal(id), listTemplates(), listOffers()]);
  if (!p) notFound();
  if (p.status === "aceita") redirect(`/comercial/propostas/${id}`);
  const active = templates.filter((t) => !t.archivedAt || t.id === p.templateId);
  const fallback = (active.find((t) => t.isDefault) ?? active[0])?.id ?? "";
  const images = await signBlockImages(await createClient(), active.flatMap((t) => t.blocks));
  const number = String(p.number).padStart(4, "0");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Comercial", href: "/comercial" }, { label: "Propostas", href: "/comercial/propostas" }, { label: `Nº ${number}`, href: `/comercial/propostas/${id}` }, { label: "Editar" }]}
        title={`Editar proposta nº ${number}`}
        description="Cada vez que você salva, nasce uma nova versão. O link do cliente só muda quando você enviar de novo."
      />
      <PageBody className="grid max-w-7xl gap-4">
        {p.sentVersion != null && <FormAlert tone="info">O cliente está vendo a versão {p.sentVersion}. Depois de salvar, use “Enviar esta versão” para atualizar o link.</FormAlert>}
        <ProposalEditor initial={draftFromProposal(p, fallback)} templates={active} offers={offers} sellerName={p.ownerName ?? user.fullName} images={images} />
      </PageBody>
    </>
  );
}
