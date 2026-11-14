import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { getLead } from "@/features/crm/queries";
import { listOffers, listTemplates } from "@/features/proposals/queries";
import { draftFromLead } from "@/features/proposals/defaults";
import { signBlockImages } from "@/features/proposals/server";
import { ProposalEditor } from "@/features/proposals/components/proposal-editor";

export const metadata: Metadata = { title: "Nova proposta" };

/** Nova proposta a partir de um lead (?lead=): os dados do lead já vêm preenchidos. */
export default async function NovaPropostaPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const [user, sp] = await Promise.all([requirePermission("proposals.manage"), searchParams]);
  if (!sp.lead || !/^[0-9a-f-]{36}$/i.test(sp.lead)) notFound();
  const [lead, templates, offers] = await Promise.all([getLead(sp.lead), listTemplates(), listOffers()]);
  if (!lead) notFound();
  const active = templates.filter((t) => !t.archivedAt);
  const tpl = active.find((t) => t.isDefault) ?? active[0];
  const images = await signBlockImages(await createClient(), active.flatMap((t) => t.blocks));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Comercial", href: "/comercial" }, { label: lead.name, href: `/comercial/leads/${lead.id}` }, { label: "Nova proposta" }]}
        title="Nova proposta"
        description="Preencha só o que muda. A prévia ao lado é o documento que o cliente vai ver e baixar em PDF."
      />
      <PageBody className="max-w-7xl">
        {!tpl ? (
          <EmptyState
            title="Nenhum modelo de proposta ativo"
            description="Crie ou reative um modelo em Configurações › Propostas."
            action={user.permissions["proposals.templates.manage"] ? <Link href="/configuracoes/propostas" className="text-sm font-medium text-primary hover:underline">Abrir os modelos</Link> : undefined}
          />
        ) : (
          <ProposalEditor initial={draftFromLead(lead, tpl)} templates={active} offers={offers} sellerName={lead.ownerName ?? user.fullName} images={images} />
        )}
      </PageBody>
    </>
  );
}
