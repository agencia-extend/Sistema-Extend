import type { ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import { CreativesNav } from "./creatives-nav";

const ANY = ["creatives.request.create", "creatives.produce", "creatives.review", "creatives.library.manage"] as const;

/** Criativos: pedido do tráfego para as mídias, produção, aprovação e biblioteca. */
export default async function CriativosLayout({ children }: { children: ReactNode }) {
  const user = await requirePermission([...ANY]);
  const canRequest = Boolean(user.permissions["creatives.request.create"]);
  return (
    <>
      <PageHeader
        title="Criativos"
        description="O tráfego pede pelo formulário, a mídia produz e envia as versões, o pedido é aprovado aqui e pelo cliente, e o aprovado vai para a biblioteca."
        actions={canRequest ? <Link href="/criativos/novo" className={buttonVariants()}><Plus aria-hidden="true" /> Pedir criativo</Link> : undefined}
        className="pb-2"
      />
      <CreativesNav showMine={canRequest} />
      <div className="px-4 pt-5 pb-10 sm:px-6">{children}</div>
    </>
  );
}
