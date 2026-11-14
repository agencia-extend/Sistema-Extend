import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { formatDateTime } from "@/domain/shared/dates";
import { getTemplate, listOffers } from "@/features/proposals/queries";
import { signBlockImages } from "@/features/proposals/server";
import { TemplateEditor } from "@/features/proposals/components/template-editor";
import { RestoreVersion, TemplateActions } from "@/features/proposals/components/template-actions";

export const metadata: Metadata = { title: "Modelo de proposta" };

export default async function ModeloPage({ params }: { params: Promise<{ id: string }> }) {
  const [, { id }] = await Promise.all([requirePermission("proposals.templates.manage"), params]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, offers] = await Promise.all([getTemplate(id), listOffers()]);
  if (!t) notFound();
  const images = await signBlockImages(await createClient(), t.blocks);
  const sampleItems = offers
    .filter((o) => o.isActive && o.priceCents != null)
    .slice(0, 3)
    .map((o) => ({ serviceId: o.serviceId, name: o.name, description: o.description, priceCents: o.priceCents!, discountCents: 0, quantity: 1, recurrence: o.recurrence }));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Configurações", href: "/configuracoes" }, { label: "Propostas", href: "/configuracoes/propostas" }, { label: t.name }]}
        title={t.name}
        description={`Versão ${t.version}${t.isDefault ? " · modelo padrão" : ""}${t.archivedAt ? " · arquivado" : ""}. Propostas já criadas guardam a versão que usaram.`}
        actions={<TemplateActions id={t.id} isDefault={t.isDefault} archived={Boolean(t.archivedAt)} />}
      />
      <PageBody className="grid max-w-7xl gap-8">
        <TemplateEditor
          key={t.version}
          initial={{ id: t.id, name: t.name, blocks: t.blocks, whatsappMessage: t.whatsappMessage, validityDays: String(t.validityDays) }}
          images={images}
          sampleItems={sampleItems}
        />
        <section aria-labelledby="versoes" className="grid max-w-xl gap-2">
          <h2 id="versoes" className="text-base font-semibold">Versões</h2>
          <ol className="divide-y rounded-xl border bg-card">
            {t.versions.map((v) => (
              <li key={v.version} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                <span>
                  <span className="font-medium">Versão {v.version}</span>{v.version === t.version && <span className="ml-2 text-xs text-muted-foreground">(atual)</span>}
                  <span className="block text-xs text-muted-foreground tabular">{formatDateTime(v.createdAt)}{v.author ? ` · ${v.author}` : ""}</span>
                </span>
                {v.version !== t.version && <RestoreVersion id={t.id} version={v.version} />}
              </li>
            ))}
          </ol>
        </section>
      </PageBody>
    </>
  );
}
