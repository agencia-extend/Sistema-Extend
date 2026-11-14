import type { Metadata } from "next";
import { Target } from "lucide-react";
import { requirePortal } from "@/lib/auth/dal";
import { portalStrategy } from "@/features/portal/queries";
import { RichText } from "@/features/portal/components/rich-text";
import { EmptyState } from "@/components/app/states";
import { formatDate } from "@/domain/shared/dates";

export const metadata: Metadata = { title: "Estratégia" };

/** Estratégia/planejamento publicado pela agência. */
export default async function PortalStrategyPage() {
  const { clientId } = await requirePortal();
  const s = await portalStrategy(clientId);
  return (
    <>
      <header className="grid gap-1">
        <h1 className="font-heading text-2xl font-semibold">Estratégia</h1>
        <p className="text-sm text-muted-foreground">{s ? `Planejamento do seu projeto, atualizado em ${formatDate(s.published_at)}.` : "O planejamento combinado com a agência."}</p>
      </header>
      {!s ? (
        <EmptyState icon={Target} title="Estratégia ainda não publicada" description="Assim que a equipe publicar o planejamento do seu projeto, ele aparece aqui e você recebe um aviso." />
      ) : (
        <article className="max-w-prose rounded-xl border bg-card p-5 text-[15px] leading-relaxed sm:p-6">
          <RichText text={s.body} />
        </article>
      )}
    </>
  );
}
