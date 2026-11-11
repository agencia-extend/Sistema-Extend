import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { listSectors } from "@/features/admin/queries";
import { listTeam } from "@/features/clients/queries";
import type { FormSection } from "@/features/clients/schemas";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { FormEditor } from "./form-editor";
import { ChecklistTemplates } from "./checklist-templates";
import { Recipients } from "./recipients";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingSettingsPage() {
  const user = await requirePermission("settings.manage");
  const supabase = await createClient();
  const [form, templates, sectors, team, org] = await Promise.all([
    supabase.from("onboarding_forms").select("version, sections, created_at").eq("is_current", true).maybeSingle(),
    supabase.from("onboarding_checklist_templates").select("id, title, default_sector_id, due_days, is_active, position").order("position"),
    listSectors(),
    listTeam(),
    supabase.from("organizations").select("settings").eq("id", user.organizationId).single(),
  ]);
  const settings = (org.data?.settings ?? {}) as { onboarding_recipient_ids?: string[] };

  return (
    <>
      <PageHeader title="Onboarding" description="Perguntas da ficha, checklist padrão de todo cliente novo e quem é avisado quando o comercial fecha um contrato." />
      <PageBody className="grid max-w-4xl gap-10">
        <Recipients team={team.map((t) => ({ id: t.id, name: t.name }))} selected={settings.onboarding_recipient_ids ?? []} />
        <ChecklistTemplates
          sectors={sectors.map((s) => ({ id: s.id, name: s.name }))}
          items={(templates.data ?? []).map((t) => ({ id: t.id, title: t.title, default_sector_id: t.default_sector_id, due_days: t.due_days, is_active: t.is_active }))}
        />
        <FormEditor version={form.data?.version ?? 0} initial={(form.data?.sections ?? []) as unknown as FormSection[]} />
      </PageBody>
    </>
  );
}
