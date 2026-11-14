import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "./reset-request-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecuperarSenhaPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5 text-center">
        <h1 className="font-heading text-2xl font-semibold text-balance">Recuperar senha</h1>
        <p className="text-sm text-muted-foreground">Informe seu e-mail. Enviaremos um link para você criar uma nova senha.</p>
      </div>
      <ResetRequestForm />
      <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Voltar para o login
      </Link>
    </div>
  );
}
