import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { formatDateTime } from "@/domain/shared/dates";
import { createClient } from "@/lib/supabase/server";
import { listLinkableClients } from "@/features/integrations/queries";
import { ServerForm } from "@/features/whatsapp/components/server-form";
import { ConnectionCard } from "@/features/whatsapp/components/connection-card";
import { GroupsTable } from "@/features/whatsapp/components/groups-table";

export const metadata: Metadata = { title: "WhatsApp" };

const KIND: Record<string, string> = { teste: "Teste", alerta: "Alerta", relatorio: "Relatório" };

/** RF-WPP-01/02: servidor WAHA, conexão do número por QR Code, grupos (clientes e alertas internos) e envios. */
export default async function WhatsappPage() {
  await requirePermission("integrations.manage");
  const supabase = await createClient();
  const [{ data: statusRows }, clients] = await Promise.all([supabase.rpc("whatsapp_status"), listLinkableClients()]);
  const conn = statusRows?.[0] ?? null;
  const [{ data: groups }, { data: sends }] = conn
    ? await Promise.all([
        supabase.from("whatsapp_groups").select("id, name, client_id, is_alerts, is_reports").eq("connection_id", conn.id).order("name"),
        supabase.from("whatsapp_outbox").select("id, kind, chat_name, ok, error, created_at").eq("connection_id", conn.id).order("created_at", { ascending: false }).limit(10),
      ])
    : [{ data: [] }, { data: [] }];
  const connected = conn?.status === "WORKING";

  return (
    <>
      <PageHeader title="WhatsApp" description="Número da Extend conectado por QR Code. Recebe as conversas do Atendimento e envia os relatórios dos clientes e os alertas de anúncios para os grupos da equipe." />
      <PageBody className="grid max-w-4xl gap-10">
        <section aria-labelledby="numero" className="grid gap-4">
          <div className="grid gap-1">
            <h2 id="numero" className="text-base font-semibold">Número</h2>
            <p className="text-sm text-muted-foreground">Clique em Conectar WhatsApp e leia o QR Code com o celular do número da Extend. Depois, compile as conversas para trazer o histórico ao Atendimento.</p>
          </div>
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <ConnectionCard
              status={conn?.status ?? null}
              canDisconnect
              me={conn && (conn.me_name || conn.me_id) ? `${conn.me_name ?? ""} (${(conn.me_id ?? "").replace(/@.*/, "")})`.trim() : null}
            />
            {conn?.last_error && <p role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{conn.last_error}</p>}
          </div>
        </section>

        {conn && (
          <section aria-labelledby="grupos" className="grid gap-4">
            <div className="grid gap-1">
              <h2 id="grupos" className="text-base font-semibold">Grupos</h2>
              <p className="text-sm text-muted-foreground">Escolha o grupo de relatórios (todos os relatórios dos clientes chegam nele; o gestor encaminha a cada cliente) e o de alertas internos (saldo acabando, conta parada, anúncio reprovado). Pode ser o mesmo grupo.</p>
            </div>
            <GroupsTable connected={connected} clients={clients} groups={(groups ?? []).map((g) => ({ id: g.id, name: g.name, clientId: g.client_id, isAlerts: g.is_alerts, isReports: g.is_reports }))} />
          </section>
        )}

        <details className="group rounded-xl border bg-card">
          <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-medium outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring sm:px-5 [&::-webkit-details-marker]:hidden">
            Servidor do WhatsApp <span className="font-normal text-muted-foreground">· {conn ? conn.base_url : "ainda não informado"}</span>
          </summary>
          <div className="grid gap-3 border-t px-4 py-4 sm:px-5">
            <p className="text-sm text-muted-foreground">O túnel da máquina do servidor informa o endereço sozinho quando liga ou muda. Só preencha aqui para usar outro servidor (por exemplo, a VPS). Trocar não exige novo deploy.</p>
            <ServerForm baseUrl={conn?.base_url ?? null} hasServer={Boolean(conn)} />
          </div>
        </details>

        {conn && (sends ?? []).length > 0 && (
          <section aria-labelledby="envios" className="grid gap-3">
            <h2 id="envios" className="text-base font-semibold">Últimos envios</h2>
            <ul className="divide-y rounded-xl border bg-card text-sm">
              {(sends ?? []).map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2">
                  <span>{KIND[s.kind] ?? s.kind} · {s.chat_name ?? "—"}</span>
                  <span className={s.ok === false ? "text-danger" : "text-muted-foreground"}>{s.ok === false ? `Falhou: ${s.error}` : formatDateTime(s.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageBody>
    </>
  );
}
