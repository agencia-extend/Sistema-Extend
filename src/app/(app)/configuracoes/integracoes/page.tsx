import type { Metadata } from "next";
import { Plug } from "lucide-react";
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

export default async function IntegracoesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("ads.connect");
  const q = await searchParams;
  const setup = integrationSetup();
  const [connections, accounts, clients] = await Promise.all([listConnections(), listAdAccounts(), listLinkableClients()]);
  const meta = connections.find((c) => c.owner === "agency" && c.provider === "meta");
  const google = connections.find((c) => c.owner === "agency" && c.provider === "google");
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
              <a href="/api/integracoes/google/conectar?para=agencia" className={buttonVariants({ variant: "outline" }) + " justify-self-start"}>Entrar com o Google</a>
            ) : null}
          </div>
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
      </PageBody>
    </>
  );
}
