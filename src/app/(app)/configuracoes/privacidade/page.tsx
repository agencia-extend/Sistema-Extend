import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { REQUEST_KIND_SHORT, REQUEST_STATUS_LABEL, deadlineState } from "@/domain/privacy";
import { dayLabel } from "@/domain/trainings";
import { todayKey } from "@/domain/media";
import { formatDate } from "@/domain/shared/dates";
import { allRequests, consentCoverage, controllerForEdit } from "@/features/privacy/queries";
import { AnswerDialog } from "@/features/privacy/components/answer-dialog";
import { ControllerForm } from "@/features/privacy/components/controller-form";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Privacidade (LGPD)" };

const DUE = {
  atrasado: { text: "Prazo vencido", cls: "font-medium text-danger" },
  vence_logo: { text: "Vence em breve", cls: "font-medium text-warning" },
  no_prazo: { text: "No prazo", cls: "text-muted-foreground" },
  fechado: { text: "", cls: "text-muted-foreground" },
} as const;

export default async function PrivacidadeAdminPage() {
  await requirePermission("privacy.manage");
  const [requests, controller, coverage] = await Promise.all([allRequests(), controllerForEdit(), consentCoverage()]);
  const today = todayKey(new Date());
  const open = requests.filter((r) => r.status === "aberto" || r.status === "em_andamento").length;

  return (
    <>
      <PageHeader
        title="Privacidade (LGPD)"
        description={
          <>
            Pedidos das pessoas sobre os próprios dados (prazo legal de 15 dias) e quem responde pelos dados na{" "}
            <Link href="/privacidade" target="_blank" className="font-medium text-brand underline underline-offset-2">Política de Privacidade</Link>.
          </>
        }
      />
      <PageBody className="grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-10">
        <section aria-labelledby="pedidos" className="grid gap-3">
          <div className="grid gap-1">
            <h2 id="pedidos" className="text-base font-semibold">Pedidos</h2>
            <p className="text-sm text-muted-foreground">
              {requests.length === 0
                ? "Nenhum pedido até agora. Quando alguém pedir pelo Meu perfil, você recebe um aviso e o pedido aparece aqui."
                : `${open} em aberto de ${requests.length}.`}
            </p>
          </div>
          {requests.length > 0 && (
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground max-sm:sr-only">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Pessoa</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Pedido</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Prazo</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Situação</th>
                    <th scope="col" className="w-24 px-2 py-2.5"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((r) => {
                    const due = DUE[deadlineState(r.dueOn, r.status, today)];
                    const name = r.person?.name ?? "Pessoa removida";
                    return (
                      <tr key={r.id} className="align-top max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3 max-sm:gap-y-1 max-sm:px-4 max-sm:py-3">
                        <td className="px-4 py-3 max-sm:p-0">
                          <span className="font-medium break-words">{name}</span>
                          <span className="block text-xs text-muted-foreground tabular">em {formatDate(r.createdAt)}</span>
                        </td>
                        <td className="px-4 py-3 max-sm:col-start-1 max-sm:p-0">
                          {REQUEST_KIND_SHORT[r.kind]}
                          {r.details && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{r.details}</span>}
                        </td>
                        <td className="px-4 py-3 tabular max-sm:col-start-1 max-sm:p-0 max-sm:text-xs">
                          {dayLabel(r.dueOn)}
                          {due.text && <span className={cn("block text-xs", due.cls)}>{due.text}</span>}
                        </td>
                        <td className="px-4 py-3 max-sm:col-start-1 max-sm:p-0 max-sm:text-xs">{REQUEST_STATUS_LABEL[r.status]}</td>
                        <td className="px-2 py-2.5 max-sm:col-start-2 max-sm:row-span-4 max-sm:row-start-1 max-sm:p-0">
                          {(r.status === "aberto" || r.status === "em_andamento") && <AnswerDialog id={r.id} person={name} kind={r.kind} details={r.details} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="ciencia" className="grid gap-1">
          <h2 id="ciencia" className="text-base font-semibold">Ciência da política</h2>
          <p className="text-sm text-muted-foreground tabular">
            {coverage.aware} de {coverage.total} pessoas ativas já leram a versão atual. Quem ainda não leu vê um aviso no topo do sistema.
          </p>
        </section>

        <section aria-labelledby="controlador" className="grid gap-4">
          <div className="grid gap-1">
            <h2 id="controlador" className="text-base font-semibold">Controlador e encarregado</h2>
            <p className="text-sm text-muted-foreground">Aparecem na Política de Privacidade e nos Termos de uso públicos.</p>
          </div>
          <ControllerForm initial={controller} />
        </section>
      </PageBody>
    </>
  );
}
