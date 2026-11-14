import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { formatDateTime } from "@/domain/shared/dates";
import { listOffers, listTemplates } from "@/features/proposals/queries";
import { OffersEditor } from "@/features/proposals/components/offers-editor";

export const metadata: Metadata = { title: "Propostas" };

export default async function ConfigPropostasPage() {
  await requirePermission("proposals.templates.manage");
  const [templates, offers] = await Promise.all([listTemplates(), listOffers()]);
  return (
    <>
      <PageHeader title="Propostas" description="Modelos de proposta e o preço padrão de cada serviço. Na proposta, o vendedor pode ajustar valores e descontos." />
      <PageBody className="grid max-w-3xl gap-10">
        <section aria-labelledby="modelos" className="grid gap-3">
          <h2 id="modelos" className="text-base font-semibold">Modelos</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {templates.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0">
                  <Link href={`/configuracoes/propostas/${t.id}`} className="font-medium hover:underline">{t.name}</Link>
                  {t.isDefault && <span className="ml-2 rounded-full bg-info-soft px-2 text-xs text-info">padrão</span>}
                  {t.archivedAt && <span className="ml-2 rounded-full bg-neutral-soft px-2 text-xs text-neutral-status">arquivado</span>}
                  <span className="block text-xs text-muted-foreground tabular">versão {t.version} · {t.blocks.length} blocos · alterado em {formatDateTime(t.updatedAt)}{t.updatedBy ? ` por ${t.updatedBy}` : ""}</span>
                </span>
                <Link href={`/configuracoes/propostas/${t.id}`} className="text-sm font-medium text-primary hover:underline">Editar<span className="sr-only"> {t.name}</span></Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Para criar outro modelo, abra um existente e use “Duplicar”.</p>
        </section>
        <section aria-labelledby="precos" className="grid gap-3">
          <h2 id="precos" className="text-base font-semibold">Serviços e preços</h2>
          <p className="text-sm text-muted-foreground">Os serviços vêm do catálogo (Configurações › Serviços). Sem preço padrão, o vendedor digita o valor na proposta.</p>
          <OffersEditor offers={offers} />
        </section>
      </PageBody>
    </>
  );
}
