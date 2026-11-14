import type { Metadata } from "next";
import { publicController } from "@/features/privacy/queries";
import { TERMS_SECTIONS, TermsContent } from "@/features/privacy/components/terms-content";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Termos de uso", description: "Regras de uso do sistema interno da Agência Extend." };
export const dynamic = "force-dynamic";

export default async function TermosPage() {
  const c = await publicController();
  return (
    <LegalPage title="Termos de uso" intro="As regras para usar o sistema interno da Agência Extend com segurança e respeito aos dados de colegas e clientes." sections={TERMS_SECTIONS}>
      <TermsContent c={c} />
    </LegalPage>
  );
}
