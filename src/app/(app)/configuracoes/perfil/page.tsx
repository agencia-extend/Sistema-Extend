import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ProfileForm, PasswordForm } from "./profile-forms";
import { myRequests } from "@/features/privacy/queries";
import { MyPrivacy } from "@/features/privacy/components/my-privacy";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function PerfilPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data }, requests] = await Promise.all([supabase.from("profiles").select("phone_e164").eq("id", user.id).single(), myRequests(user.id)]);
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
        <MyPrivacy requests={requests} />
      </PageBody>
    </>
  );
}
