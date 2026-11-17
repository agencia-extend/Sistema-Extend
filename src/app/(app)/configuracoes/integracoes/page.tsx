import type { Metadata } from "next";
import Link from "next/link";
import { Plug } from "lucide-react";
import { connectionLabel } from "@/domain/integrations";
import { formatDateTime } from "@/domain/shared/dates";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/states";
import { FormAlert } from "@/components/app/form-field";
import { buttonVariants } from "@/components/ui/button";
import { integrationSetup, listAdAccounts, listConnections, listLinkableClients } from "@/features/integrations/queries";
import { ConnectionPanel } from "@/features/integrations/components/connection-panel";
import { SystemTokenForm } from "@/features/integrations/components/system-token-form";
import { SetupNotice } from "@/features/integrations/components/setup-notice";
import { AdAccountsTable } from "@/features/integrations/components/ad-accounts-table";
import { listSocialProfiles } from "@/features/social/queries";
import { SocialProfilesTable } from "@/features/social/components/social-profiles-table";
import { RefreshSocialButton } from "@/features/social/components/refresh-social-button";
import { GoogleButton } from "@/features/integrations/components/google-button";

export const metadata: Metadata = { title: "Integrações" };

const ERRORS: Record<string, string> = {
  configuracao: "A conexão ainda não está configurada no servidor.",
  cancelado: "A conexão foi cancelada antes de terminar. Nada mudou.",
  estado: "O pedido de conexão expirou ou veio de outra aba. Tente de novo.",
  permissao: "Você não tem permissão para esta conexão.",
  escopo: "A permissão necessária não foi marcada na tela do Google. Conecte de novo e marque todas as caixas.",
  troca: "Não foi possível concluir a conexão.",
};

function Feedback({ q }: { q: Record<string, string | undefined> }) {
  if (q.erro) return <FormAlert>{q.detalhe ?? ERRORS[q.erro] ?? "Não foi possível conectar."}</FormAlert>;
  if (q.conectado) {
    const name = q.conectado === "meta" ? "Meta" : "Google Ads";
    if (q.detalhe) return <FormAlert>{`${name} conectado, mas a busca das contas falhou: ${q.detalhe}`}</FormAlert>;
    const n = Number(q.contas ?? 0);
    return <FormAlert tone="success">{`${name} conectado. ${n} ${n === 1 ? "conta de anúncio encontrada" : "contas de anúncio encontradas"}; escolha abaixo quais entram e de qual cliente são.`}</FormAlert>;
  }
  return null;
}

export const maxDuration = 60;

export default async function IntegracoesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("ads.connect");
  const q = await searchParams;
  const setup = integrationSetup();
  const [connections, accounts, clients, profiles] = await Promise.all([listConnections(), listAdAccounts(), listLinkableClients(), listSocialProfiles()]);
  const meta = connections.find((c) => c.owner === "agency" && c.provider === "meta");
  const google = connections.find((c) => c.owner === "agency" && c.provider === "google");
  const clientConns = connections.filter((c) => c.owner === "client").sort((a, b) => (a.clientName ?? "").localeCompare(b.clientName ?? "", "pt-BR"));
  const metaReady = setup.meta.missing.length === 0;
  const googleReady = setup.google.missing.length === 0;

  return (
    <>
      <PageHeader
        title="Integrações"
        description="Conexões da agência com a Meta e o Google. As contas escolhidas aqui alimentam o tráfego, os relatórios e os números dos criativos."
      />
      <PageBody className="grid max-w-5xl gap-10">
        <Feedback q={q} />

        <section aria-labelledby="meta" className="grid gap-4">
          <div className="grid gap-1">
            <h2 id="meta" className="text-base font-semibold">Meta (Facebook e Instagram)</h2>
            <p className="text-sm text-muted-foreground">BM da Extend: contas de anúncio próprias e as de clientes compartilhadas com o BM.</p>
          </div>
          <div className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
            {!metaReady || !meta ? <SetupNotice missing={setup.meta.missing} redirectUri={setup.meta.redirectUri} platform="no app da Meta (Login do Facebook para Empresas › URIs de redirecionamento do OAuth válidos)" /> : null}
            {meta ? (
              <ConnectionPanel
                conn={meta}
                title="a Meta"
                reconnectHref={meta.method === "oauth" && metaReady ? "/api/integracoes/meta/conectar?para=agencia" : undefined}
                extra={
                  meta.method === "system_user" ? (
                    <details className="w-full">
                      <summary className="cursor-pointer text-sm font-medium text-primary">Trocar o token</summary>
                      <div className="pt-3"><SystemTokenForm replacing /></div>
                    </details>
                  ) : null
                }
              />
            ) : metaReady ? (
              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid content-start gap-2">
                  <h3 className="text-sm font-semibold">Recomendado: usuário do sistema do BM</h3>
                  <p className="text-sm text-muted-foreground">Não vence a cada 60 dias e não depende da conta pessoal de ninguém.</p>
                  <SystemTokenForm />
                </div>
                <div className="grid content-start gap-2">
                  <h3 className="text-sm font-semibold">Ou: entrar com o Facebook</h3>
                  <p className="text-sm text-muted-foreground">Usa o login de quem administra o BM. Vale por cerca de 60 dias; o sistema avisa uma semana antes de vencer.</p>
                  <a href="/api/integracoes/meta/conectar?para=agencia" className={buttonVariants({ variant: "outline" }) + " justify-self-start"}>Entrar com o Facebook</a>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="google" className="grid gap-4">
          <div className="grid gap-1">
            <h2 id="google" className="text-base font-semibold">Google Ads (MCC)</h2>
            <p className="text-sm text-muted-foreground">Entre com o e-mail que administra a MCC da Extend: o sistema encontra a MCC e todas as contas de clientes dentro dela.</p>
          </div>
          <div className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
            {!googleReady || !google ? <SetupNotice missing={setup.google.missing} redirectUri={setup.google.redirectUri} platform="no Google Cloud (Credenciais › ID do cliente OAuth › URIs de redirecionamento autorizados)" /> : null}
            {google ? (
              <ConnectionPanel conn={google} title="o Google Ads" reconnectHref={googleReady ? "/api/integracoes/google/conectar?para=agencia" : undefined} />
            ) : googleReady ? (
              <GoogleButton href="/api/integracoes/google/conectar?para=agencia" />
            ) : null}
          </div>
        </section>

        <section aria-labelledby="facebook-clientes" className="grid gap-4">
          <div className="grid gap-1">
            <h2 id="facebook-clientes" className="text-base font-semibold">Facebook dos clientes</h2>
            <p className="text-sm text-muted-foreground">
              Para contas de anúncio que estão no perfil do cliente e não no BM da Extend. Conecte (ou envie o link para o cliente autorizar) na aba Tráfego de cada cliente.
            </p>
          </div>
          {clientConns.length === 0 ? (
            <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Nenhum cliente conectou o Facebook ainda.</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {clientConns.map((c) => {
                const label = connectionLabel({ status: c.status, expiresAt: c.expiresAt });
                const bad = label === "Expirada" || label === "Com erro";
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span className="grid min-w-0">
                      <Link href={`/clientes/${c.clientId}/trafego#facebook`} className="font-medium break-words hover:underline">{c.clientName}</Link>
                      <span className="text-xs text-muted-foreground">Facebook de {c.accountName ?? "—"}{c.expiresAt ? ` · vale até ${formatDateTime(c.expiresAt)}` : ""}</span>
                    </span>
                    <span className={bad ? "font-medium text-danger" : label.startsWith("Vence") ? "font-medium text-warning" : "font-medium text-success"}>{label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="contas" className="grid gap-4">
          <div className="grid gap-1">
            <h2 id="contas" className="text-base font-semibold">Contas de anúncio</h2>
            <p className="text-sm text-muted-foreground">
              Escolha de qual cliente é cada conta e ligue as que entram no sistema. Só as ligadas são sincronizadas e aparecem para a equipe do cliente.
            </p>
          </div>
          {accounts.length === 0 ? (
            <EmptyState
              icon={Plug}
              title="Nenhuma conta encontrada ainda"
              description="Conecte a Meta ou o Google Ads acima. As contas que a conexão enxerga aparecem aqui para você escolher."
            />
          ) : (
            <AdAccountsTable accounts={accounts} clients={clients} />
          )}
        </section>

        <section aria-labelledby="paginas" className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <h2 id="paginas" className="text-base font-semibold">Páginas e Instagram</h2>
              <p className="text-sm text-muted-foreground">
                Páginas do Facebook e perfis do Instagram que a conexão da Meta alcança (os que foram autorizados no login). Escolha de qual cliente é cada um: as últimas publicações aparecem na aba Redes sociais do cliente.
              </p>
            </div>
            {meta && <RefreshSocialButton clientId={null} label="Buscar páginas agora" />}
          </div>
          {profiles.length === 0 ? (
            <EmptyState
              icon={Plug}
              title="Nenhuma página encontrada ainda"
              description={meta ? "Clique em \"Buscar páginas agora\". Se nada aparecer, inclua as páginas e os perfis do Instagram dos clientes ao autorizar a Meta (Reconectar)." : "Conecte a Meta acima. As páginas e os perfis autorizados no login aparecem aqui."}
            />
          ) : (
            <SocialProfilesTable profiles={profiles} clients={clients} />
          )}
        </section>
      </PageBody>
    </>
  );
}
