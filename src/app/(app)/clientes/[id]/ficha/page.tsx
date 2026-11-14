import { requirePermission } from "@/lib/auth/dal";
import { currentServices, upcomingServices, getClient, getMissing, getOnboarding, getOperationalSummary, listTeam } from "@/features/clients/queries";
import { sectionApplies } from "@/domain/clients";
import { formatDateTime } from "@/domain/shared/dates";
import { todayKey } from "@/domain/media";
import { Section } from "@/features/clients/components/section";
import { FormAlert } from "@/components/app/form-field";
import { OnboardingForm } from "./onboarding-form";
import { Checklist } from "./checklist";
import { CompleteOnboarding } from "./complete-onboarding";

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("clients.read");
  const { id } = await params;
  const client = (await getClient(id))!;
  const ob = await getOnboarding(id);

  // RF-ONB-06: quem não vê a ficha completa vê o resumo operacional.
  if (!ob.canReadFull) {
    const summary = await getOperationalSummary(id);
    const sections = [...new Set(summary.map((s) => s.section))];
    return (
      <div className="grid max-w-3xl gap-6">
        <FormAlert tone="info">Este é o resumo operacional da ficha: o que você precisa para produzir para este cliente.</FormAlert>
        {summary.length === 0 ? (
          <p className="text-sm text-muted-foreground">A ficha ainda não foi preenchida.</p>
        ) : (
          sections.map((s) => (
            <Section key={s} title={s}>
              <dl className="grid gap-3 rounded-xl border bg-card p-4">
                {summary.filter((x) => x.section === s).map((x) => (
                  <div key={x.label} className="grid gap-0.5">
                    <dt className="text-xs text-muted-foreground">{x.label}</dt>
                    <dd className="text-sm whitespace-pre-line">{x.answer}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          ))
        )}
      </div>
    );
  }

  const canEdit = Boolean(user.permissions["clients.onboarding.manage"]) && !ob.completedAt;
  // Briefing por seções: só as dos serviços contratados (A e Obrigações sempre).
  const tabs = [...currentServices(client), ...upcomingServices(client)].flatMap((s) => (Array.isArray(s.service_catalog) ? s.service_catalog : s.service_catalog ? [s.service_catalog] : []).flatMap((c) => c.tabs));
  const sections = ob.sections.filter((s) => sectionApplies(s.show_for, tabs));
  const [team, missing] = await Promise.all([listTeam(), client.status === "onboarding" ? getMissing(id) : Promise.resolve([])]);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid content-start gap-6">
        {ob.completedAt && <FormAlert tone="success">Onboarding concluído em {formatDateTime(ob.completedAt)}. A ficha fica guardada como estava.</FormAlert>}
        <OnboardingForm clientId={id} sections={sections} answers={ob.answers} canEdit={canEdit} savedAt={ob.updatedAt} />
      </div>
      <div className="grid content-start gap-6">
        {client.status === "onboarding" && (
          <CompleteOnboarding clientId={id} missing={missing} canComplete={Boolean(user.permissions["clients.onboarding.manage"])} />
        )}
        <Checklist
          clientId={id}
          items={ob.checklist.map((c) => ({ id: c.id, title: c.title, guidance: c.guidance, milestone: c.milestone, assigneeId: c.assignee_id, assigneeName: c.assignee_name, dueAt: c.due_at, doneAt: c.done_at }))}
          milestones={ob.milestones}
          today={todayKey(new Date())}
          team={team.map((t) => ({ id: t.id, name: t.name }))}
          canManage={Boolean(user.permissions["clients.onboarding.manage"]) && client.status === "onboarding"}
          userId={user.id}
        />
      </div>
    </div>
  );
}
