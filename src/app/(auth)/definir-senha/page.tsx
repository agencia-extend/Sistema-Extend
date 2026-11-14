import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/dal";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Nova senha" };

export default async function DefinirSenhaPage() {
  const session = await getSession();
  if (session.state === "anonymous") redirect("/login?motivo=link");
  if (session.state === "inactive") redirect("/sair?motivo=desativado");
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5 text-center">
        <h1 className="font-heading text-2xl font-semibold text-balance">Crie uma nova senha</h1>
        <p className="text-sm text-muted-foreground">Para {session.user.email}. Use pelo menos 8 caracteres, com letras e números.</p>
      </div>
      <NewPasswordForm />
    </div>
  );
}
