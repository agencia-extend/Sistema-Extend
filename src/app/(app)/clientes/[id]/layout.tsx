import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { currentServices, getClient } from "@/features/clients/queries";
import { clientTabs, type ClientStatus } from "@/domain/clients";
import { PageHeader } from "@/components/app/page-header";
import { ClientStatusBadge } from "@/features/clients/components/bits";
import { ClientTabsNav } from "./tabs-nav";
import { StatusMenu } from "./status-menu";

export default async function ClientLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const user = await requirePermission("clients.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const client = await getClient(id);
  if (!client) notFound();
  const status = client.status as ClientStatus;
  const tabs = clientTabs(
    status,
    currentServices(client).flatMap((s) => (Array.isArray(s.service_catalog) ? s.service_catalog : s.service_catalog ? [s.service_catalog] : []).flatMap((c) => c.tabs)),
    user.permissions,
  );
  const canManage = Boolean(user.permissions["clients.manage"]);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Clientes", href: "/clientes" }, { label: client.name }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {client.name} <ClientStatusBadge status={status} />
          </span>
        }
        description={client.segment ?? undefined}
        actions={canManage && status !== "onboarding" ? <StatusMenu clientId={id} status={status} canArchive={user.permissions["clients.manage"] === "all"} /> : undefined}
        className="pb-2"
      />
      <ClientTabsNav base={`/clientes/${id}`} tabs={tabs} />
      <div className="px-4 pt-5 pb-10 sm:px-6">{children}</div>
    </>
  );
}
