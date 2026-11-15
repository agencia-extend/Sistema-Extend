import type { Metadata } from "next";
import { History, Plus, Wallet } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/states";
import { Section } from "@/features/clients/components/section";
import { todayKey } from "@/domain/media";
import { listBudgets, listChanges } from "@/features/traffic/queries";
import { BudgetDialog } from "@/features/traffic/components/budget-dialog";
import { BudgetList } from "@/features/traffic/components/budget-list";
import { ChangeDialog } from "@/features/traffic/components/change-dialog";
import { ChangeLog } from "@/features/traffic/components/change-log";

export const metadata: Metadata = { title: "Tráfego do cliente" };

/** Aba Tráfego: verbas aprovadas pelo cliente (RF-T2-03) e registro de alterações das contas (RF-OTI-03). */
export default async function TrafegoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(["ads.read", "optimization.manage"]);
  const { id } = await params;
  const [changes, budgets] = await Promise.all([listChanges(id), listBudgets(id)]);
  const canManage = Boolean(user.permissions["optimization.manage"]);
  const today = todayKey(new Date());

  return (
    <div className="grid max-w-5xl gap-10">
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
    </div>
  );
}
