import type { ReactNode } from "react";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import { CommercialNav } from "./commercial-nav";

/** Comercial: funil em quadro, lista de leads, painel e importação. */
export default async function ComercialLayout({ children }: { children: ReactNode }) {
  const user = await requirePermission("crm.leads.read");
  return (
    <>
      <PageHeader
        title="Comercial"
        description="Cada lead com origem, responsável e próxima ação. Lead parado além do prazo da etapa avisa o responsável; o ganho vira fechamento e o cliente entra em onboarding."
        actions={
          user.permissions["crm.pipeline.configure"] ? (
            <Link href="/configuracoes/funis" className={buttonVariants({ variant: "outline" })}><Settings2 aria-hidden="true" /> Configurar funis</Link>
          ) : undefined
        }
        className="pb-2"
      />
      <CommercialNav canImport={Boolean(user.permissions["crm.leads.manage"])} canProposals={Boolean(user.permissions["proposals.read"])} />
      <div className="px-4 pt-5 pb-10 sm:px-6">{children}</div>
    </>
  );
}
