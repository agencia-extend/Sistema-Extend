import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { NamingForm } from "@/features/ads/components/naming-form";
import { getNaming } from "@/features/ads/naming-queries";
import { requirePermission } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Nomenclatura" };

/** RF-PLA-03: padrão de nome de campanha, conjunto e anúncio da agência. */
export default async function NomenclaturaPage() {
  const user = await requirePermission("ads.connect");
  const templates = await getNaming();
  return (
    <>
      <PageHeader title="Nomenclatura" description="Padrão de nome das campanhas, conjuntos e anúncios. A equipe gera os nomes em Anúncios › Gerar nome, e a aba Nomenclatura lista o que está fora do padrão nas contas." />
      <PageBody className="grid max-w-3xl gap-4">
        <p className="text-sm text-muted-foreground">
          Monte o padrão com as peças entre chaves e separe com _ ou -. A peça <span className="font-mono">{"{CR}"}</span> é o código do criativo da biblioteca (CR-42): com ela no nome do anúncio, os números aparecem no criativo sozinhos.
        </p>
        <NamingForm initial={templates} canEdit={Boolean(user.permissions["ads.connect"])} />
      </PageBody>
    </>
  );
}
