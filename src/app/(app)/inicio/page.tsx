import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, ClipboardCheck, ShieldCheck, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { FormAlert } from "@/components/app/form-field";
import { EmptyState } from "@/components/app/states";
import { TIMEZONE } from "@/domain/shared/dates";

export const metadata: Metadata = { title: "Início" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: TIMEZONE }).format(new Date()));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

export default async function InicioPage({ searchParams }: { searchParams: Promise<{ senha?: string; "bem-vindo"?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const firstName = user.fullName.split(" ")[0];
  const canUsers = Boolean(user.permissions["users.manage"]);

  let setup: { members: number; pending: number; devices: number } | null = null;
  if (canUsers) {
    const supabase = await createClient();
    const [members, pending, devices] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("invitations").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("push_subscriptions").select("id", { count: "exact", head: true }),
    ]);
    setup = { members: members.count ?? 0, pending: pending.count ?? 0, devices: devices.count ?? 0 };
  }

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName}`} description={user.sectors.map((s) => s.name).join(" · ") || undefined} />
      <PageBody className="grid gap-6">
        {params.senha === "ok" && <FormAlert tone="success">Senha atualizada.</FormAlert>}
        {params["bem-vindo"] && (
          <FormAlert tone="success">Acesso ativado. Ative as notificações neste aparelho para receber suas demandas.</FormAlert>
        )}

        <section aria-labelledby="pendencias" className="grid gap-3">
          <h2 id="pendencias" className="text-lg font-semibold">
            Minhas pendências
          </h2>
          <EmptyState
            icon={ClipboardCheck}
            title="Nenhuma pendência por enquanto"
            description="As demandas que forem atribuídas a você (vídeos, artes, criativos, onboarding) aparecem aqui com prazo e cliente. Enquanto isso, ative as notificações para ser avisado no celular."
            action={
              <Link href="/configuracoes/notificacoes" className="inline-flex min-h-10 items-center gap-2 rounded-md border bg-surface px-3 text-sm font-medium hover:bg-muted">
                <BellRing className="size-4" aria-hidden="true" /> Ativar notificações
              </Link>
            }
          />
        </section>

        {setup && (
          <section aria-labelledby="equipe" className="grid gap-3">
            <h2 id="equipe" className="text-lg font-semibold">
              Equipe no sistema
            </h2>
            <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
              <Stat label="Pessoas com acesso" value={setup.members} href="/configuracoes/usuarios" action="Convidar" icon={UserPlus} />
              <Stat label="Convites aguardando aceite" value={setup.pending} href="/configuracoes/usuarios#convites" action="Ver convites" icon={ClipboardCheck} />
              <Stat label="Meus aparelhos com notificação" value={setup.devices} href="/configuracoes/notificacoes" action="Gerenciar aparelhos" icon={ShieldCheck} />
            </div>
          </section>
        )}
      </PageBody>
    </>
  );
}

function Stat({ label, value, href, action, icon: Icon }: { label: string; value: number; href: string; action: string; icon: typeof UserPlus }) {
  return (
    <div className="grid gap-2 bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading text-3xl font-semibold tabular">{value}</p>
      <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <Icon className="size-4" aria-hidden="true" /> {action}
      </Link>
    </div>
  );
}
