import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Section } from "@/features/clients/components/section";
import { getInboxSettings, listQuickReplies, listTags } from "@/features/inbox/queries";
import { QuickRepliesManager, RadarForm, TagsManager } from "@/features/inbox/components/inbox-settings";

export const metadata: Metadata = { title: "Ajustes do atendimento" };

/** Radar, etiquetas e respostas rápidas do atendimento (quem administra o atendimento). */
export default async function AtendimentoAjustesPage() {
  await requirePermission(["inbox.manage"]);
  const [settings, tags, replies] = await Promise.all([getInboxSettings(), listTags(), listQuickReplies()]);
  return (
    <>
      <PageHeader
        title="Ajustes do atendimento"
        description="Valem para toda a equipe que atende o WhatsApp da Extend."
        actions={<Link href="/atendimento" className={buttonVariants({ variant: "outline" })}><ChevronLeft aria-hidden="true" /> Atendimento</Link>}
      />
      <PageBody className="grid max-w-3xl gap-10">
        <Section title="Radar">
          <p className="-mt-1 text-sm text-muted-foreground">Conversa de contato sem resposta há mais que este tempo entra na aba Radar, do que espera há mais tempo.</p>
          <RadarForm minutes={settings.radarMinutes} />
        </Section>
        <Section title="Respostas rápidas"><QuickRepliesManager replies={replies} /></Section>
        <Section title="Etiquetas"><TagsManager tags={tags} /></Section>
      </PageBody>
    </>
  );
}
