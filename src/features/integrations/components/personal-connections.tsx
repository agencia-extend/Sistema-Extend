import { buttonVariants } from "@/components/ui/button";
import { FormAlert } from "@/components/app/form-field";
import type { ConnectionView } from "@/features/integrations/queries";
import { ConnectionPanel } from "./connection-panel";

const ERRORS: Record<string, string> = {
  configuracao: "A conexão ainda não está configurada no servidor.",
  cancelado: "A conexão foi cancelada antes de terminar. Nada mudou.",
  estado: "O pedido de conexão expirou ou veio de outra aba. Tente de novo.",
  permissao: "Você não tem permissão para esta conexão.",
  escopo: "A permissão da agenda não foi marcada na tela do Google. Conecte de novo e marque a caixa.",
  troca: "Não foi possível concluir a conexão.",
};

/**
 * Conexões da própria pessoa: Google Agenda e, para quem gerencia anúncios, o Facebook pessoal
 * (contas de clientes que não estão no BM da Extend). Só aparece o que está configurado no servidor.
 */
export function PersonalConnections({
  calendar,
  meta,
  q,
}: {
  calendar: { available: boolean; conn: ConnectionView | undefined };
  meta: { available: boolean; conn: ConnectionView | undefined };
  q: Record<string, string | undefined>;
}) {
  if (!calendar.available && !meta.available) return null;
  const feedback = q.erro
    ? (q.detalhe ?? ERRORS[q.erro] ?? "Não foi possível conectar.")
    : q.conectado === "agenda"
      ? "Google Agenda conectada."
      : q.conectado === "meta"
        ? q.detalhe
          ? `Facebook conectado, mas a busca das contas falhou: ${q.detalhe}`
          : `Facebook conectado. ${q.contas ?? 0} contas encontradas; o gerente de tráfego escolhe quais entram no sistema.`
        : null;
  return (
    <section aria-labelledby="conexoes" id="conexoes" className="grid gap-4 scroll-mt-20">
      <div className="grid gap-1">
        <h2 id="conexoes" className="text-base font-semibold">Conexões</h2>
        <p className="text-sm text-muted-foreground">Contas suas que o sistema usa. Você pode desconectar quando quiser.</p>
      </div>
      {feedback && <FormAlert tone={q.erro || q.detalhe ? "danger" : "success"}>{feedback}</FormAlert>}
      {calendar.available && (
        <div className="grid gap-3 rounded-xl border bg-card p-4">
          <div className="grid gap-1">
            <h3 className="text-sm font-semibold">Google Agenda</h3>
            <p className="text-sm text-muted-foreground">Leva para a sua agenda do Google as gravações, reuniões e eventos do sistema em que você participa.</p>
          </div>
          {calendar.conn ? (
            <ConnectionPanel conn={calendar.conn} title="a sua Google Agenda" showAccounts={false} reconnectHref="/api/integracoes/google/conectar?para=agenda" />
          ) : (
            <a href="/api/integracoes/google/conectar?para=agenda" className={buttonVariants({ variant: "outline" }) + " justify-self-start"}>Conectar Google Agenda</a>
          )}
        </div>
      )}
      {meta.available && (
        <div className="grid gap-3 rounded-xl border bg-card p-4">
          <div className="grid gap-1">
            <h3 className="text-sm font-semibold">Facebook (contas de clientes fora do BM)</h3>
            <p className="text-sm text-muted-foreground">
              Use só se você administra contas de anúncio de clientes que não estão compartilhadas com o BM da Extend. As contas encontradas vão para Configurações › Integrações.
            </p>
          </div>
          {meta.conn ? (
            <ConnectionPanel conn={meta.conn} title="o seu Facebook" reconnectHref="/api/integracoes/meta/conectar?para=pessoal" />
          ) : (
            <a href="/api/integracoes/meta/conectar?para=pessoal" className={buttonVariants({ variant: "outline" }) + " justify-self-start"}>Conectar meu Facebook</a>
          )}
        </div>
      )}
    </section>
  );
}
