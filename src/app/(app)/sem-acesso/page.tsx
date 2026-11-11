import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { NoPermission } from "@/components/app/states";

export const metadata: Metadata = { title: "Sem acesso" };

export default function SemAcessoPage() {
  return (
    <>
      <PageHeader title="Sem acesso" />
      <PageBody className="grid gap-4">
        <NoPermission what="abrir esta página" />
        <Link href="/inicio" className="text-sm font-medium text-primary hover:underline">
          Voltar para o início
        </Link>
      </PageBody>
    </>
  );
}
