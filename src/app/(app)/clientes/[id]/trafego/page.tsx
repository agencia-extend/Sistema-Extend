import type { Metadata } from "next";
import { Ban, History, Link2, Plus, Wallet } from "lucide-react";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/states";
import { Section } from "@/features/clients/components/section";
import { todayKey } from "@/domain/media";
import { listBudgets, listChanges, listChecks, listLibraryOptions, listRejections, listUtmLinks } from "@/features/traffic/queries";
import { getClient } from "@/features/clients/queries";
import { weekStart } from "@/domain/traffic";
import { CheckHistory } from "@/features/traffic/components/check-history";
import { BudgetDialog } from "@/features/traffic/components/budget-dialog";
import { BudgetList } from "@/features/traffic/components/budget-list";
import { ChangeDialog } from "@/features/traffic/components/change-dialog";
import { ChangeLog } from "@/features/traffic/components/change-log";
import { RejectionDialog } from "@/features/traffic/components/rejection-dialog";
import { RejectionList } from "@/features/traffic/components/rejection-list";
import { UtmDialog } from "@/features/traffic/components/utm-dialog";
import { UtmList } from "@/features/traffic/components/utm-list";

export const metadata: Metadata = { title: "Tráfego do cliente" };

/** Aba Tráfego: checklists (RF-OTI-01/02), verbas aprovadas pelo cliente (RF-T2-03), registro de alterações (RF-OTI-03) e reprovações da Meta (RF-T2-02) e links com UTM (RF-ADS-11). */
export default async function TrafegoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(["ads.read", "optimization.manage"]);
  const { id } = await params;
  const canManage = Boolean(user.permissions["optimization.manage"]);
  const [client, changes, budgets, checks, rejections, library, utms] = await Promise.all([
    getClient(id),
    listChanges(id),
    listBudgets(id),
    listChecks(id),
    listRejections(id),
    canManage ? listLibraryOptions(id) : Promise.resolve([]),
    listUtmLinks(id),
  ]);
  if (!client) notFound();
  const today = todayKey(new Date());

  return (
    <div className="grid max-w-5xl gap-10">
      <Section title="Checklists">
        <CheckHistory clientId={id} clientName={client.name} today={today} monday={weekStart(today)} rows={checks} canManage={canManage} />
      </Section>

      <Section
        title="Verba aprovada pelo cliente"
        action={canManage && <BudgetDialog clientId={id} today={today} trigger={<Button size="sm"><Plus aria-hidden="true" /> Registrar verba</Button>} />}
      >
        {budgets.length ? (
          <BudgetList clientId={id} today={today} rows={budgets} canManage={canManage} />
        ) : (
          <EmptyState
            icon={Wallet}
            title="Nenhuma verba registrada"
            description={canManage ? "Quando o cliente aprovar um valor para anúncios, registre aqui com o período, quem aprovou e o print ou áudio da aprovação." : "A equipe de tráfego registra aqui as verbas aprovadas pelo cliente."}
          />
        )}
      </Section>

      <Section
        id="reprovacoes"
        title="Reprovações da Meta"
        action={canManage && <RejectionDialog clientId={id} today={today} library={library} trigger={<Button size="sm" variant="outline"><Plus aria-hidden="true" /> Registrar reprovação</Button>} />}
      >
        {rejections.length ? (
          <RejectionList clientId={id} today={today} rows={rejections} library={library} canManage={canManage} />
        ) : (
          <EmptyState
            icon={Ban}
            title="Nenhuma reprovação registrada"
            description={canManage ? "Quando a Meta reprovar um anúncio, registre o motivo e o que evitar. Aparece para quem pede e produz os próximos criativos deste cliente." : "As reprovações de anúncios deste cliente aparecem aqui, com o motivo."}
          />
        )}
      </Section>

      <Section
        title="Registro de alterações"
        action={canManage && <ChangeDialog clientId={id} today={today} trigger={<Button size="sm" variant="outline"><Plus aria-hidden="true" /> Registrar alteração</Button>} />}
      >
        {changes.length ? (
          <ChangeLog clientId={id} today={today} rows={changes} userId={user.id} canManage={canManage} />
        ) : (
          <EmptyState
            icon={History}
            title="Nenhuma alteração registrada"
            description={canManage ? "Registre cada mudança relevante nas contas (orçamento, público, criativo, pausa) com o motivo. Fica o histórico para a equipe e para o relatório." : "As mudanças feitas nas contas deste cliente aparecem aqui, com o motivo."}
          />
        )}
      </Section>

      <Section
        id="utm"
        title="Links com UTM"
        action={canManage && <UtmDialog clientId={id} trigger={<Button size="sm" variant="outline"><Plus aria-hidden="true" /> Gerar link</Button>} />}
      >
        {utms.length ? (
          <UtmList clientId={id} rows={utms} canManage={canManage} />
        ) : (
          <EmptyState
            icon={Link2}
            title="Nenhum link gerado"
            description={canManage ? "Gere o link do site com UTM para anúncios da Meta e do Google, bio, e-mail ou WhatsApp. Assim o Analytics mostra de onde veio cada visita." : "Os links com UTM deste cliente aparecem aqui para copiar."}
          />
        )}
      </Section>
    </div>
  );
}
