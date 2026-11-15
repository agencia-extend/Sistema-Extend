import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ProfileForm, PasswordForm } from "./profile-forms";
import { myRequests } from "@/features/privacy/queries";
import { MyPrivacy } from "@/features/privacy/components/my-privacy";
import { listConnections } from "@/features/integrations/queries";
import { PersonalConnections } from "@/features/integrations/components/personal-connections";
import { configured } from "@/lib/integrations/config";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function PerfilPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const q = await searchParams;
  const supabase = await createClient();
  const [{ data }, requests, connections] = await Promise.all([supabase.from("profiles").select("phone_e164").eq("id", user.id).single(), myRequests(user.id), listConnections()]);
  const mine = connections.filter((c) => c.owner === "user");
  const phone = (data?.phone_e164 as string | null)?.replace(/^\+55/, "") ?? "";

  return (
    <>
      <PageHeader title="Meu perfil" description={`${user.email} · ${user.roles.map((r) => r.name).join(", ")}`} />
      <PageBody className="grid max-w-xl gap-10">
        <section aria-labelledby="dados" className="grid gap-4">
          <h2 id="dados" className="text-base font-semibold">
            Dados pessoais
          </h2>
          <ProfileForm fullName={user.fullName} phone={phone} jobTitle={user.jobTitle} sectors={user.sectors.map((s) => s.name)} />
        </section>
        <section aria-labelledby="senha" className="grid gap-4">
          <h2 id="senha" className="text-base font-semibold">
            Trocar senha
          </h2>
          <PasswordForm />
        </section>
        <PersonalConnections
          q={q}
          calendar={{ available: configured("google") && Boolean(user.permissions["calendar.read"]), conn: mine.find((c) => c.purpose === "calendar") }}
          meta={{ available: configured("meta") && Boolean(user.permissions["ads.manage"]), conn: mine.find((c) => c.provider === "meta") }}
        />
        <MyPrivacy requests={requests} />
      </PageBody>
    </>
  );
}
