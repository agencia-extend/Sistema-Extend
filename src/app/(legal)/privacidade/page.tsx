import type { Metadata } from "next";
import { publicController } from "@/features/privacy/queries";
import { POLICY_SECTIONS, PolicyContent } from "@/features/privacy/components/policy-content";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Política de Privacidade", description: "Como o sistema interno da Agência Extend trata dados pessoais (LGPD)." };
export const dynamic = "force-dynamic";

export default async function PrivacidadePage() {
  const c = await publicController();
  return (
    <LegalPage
      title="Política de Privacidade"
      intro="Como o sistema interno da Agência Extend usa, guarda e protege dados pessoais, e como você exerce seus direitos pela Lei Geral de Proteção de Dados (Lei 13.709/2018)."
      sections={POLICY_SECTIONS}
    >
      <PolicyContent c={c} />
    </LegalPage>
  );
}
