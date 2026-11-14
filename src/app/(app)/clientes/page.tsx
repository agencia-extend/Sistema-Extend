import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, Handshake } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { listClients, listCatalog } from "@/features/clients/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ClientGrid } from "./client-grid";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage() {
  const user = await requirePermission("clients.read");
  const [clients, catalog] = await Promise.all([listClients(), listCatalog()]);
  const owners = [...new Map(clients.filter((c) => c.ownerId).map((c) => [c.ownerId!, { id: c.ownerId!, name: c.ownerName ?? "" }])).values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cada cliente com o que contratou, quem atende, quando o contrato termina e quanto do mês já foi entregue."
        actions={
          <>
            {user.permissions["clients.import"] && (
              <Link href="/clientes/importar" className={buttonVariants({ variant: "outline" })}>
                <FileSpreadsheet aria-hidden="true" /> Importar planilha
              </Link>
            )}
            {user.permissions["commercial.handoff.create"] && (
              <Link href="/clientes/novo" className={buttonVariants()}>
                <Handshake aria-hidden="true" /> Novo fechamento
              </Link>
            )}
          </>
        }
      />
      <PageBody>
        <ClientGrid
          clients={clients}
          services={catalog.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }))}
          owners={owners}
          canCreate={Boolean(user.permissions["commercial.handoff.create"])}
        />
      </PageBody>
    </>
  );
}
