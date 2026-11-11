import type { Metadata } from "next";
import { FormAlert } from "@/components/app/form-field";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const REASONS: Record<string, { tone: "info" | "danger"; text: string }> = {
  sessao: { tone: "info", text: "Sua sessão terminou porque o navegador foi fechado. Entre novamente." },
  desativado: { tone: "danger", text: "Este acesso foi desativado. Fale com o administrador da Extend." },
  saiu: { tone: "info", text: "Você saiu do sistema." },
  link: { tone: "danger", text: "O link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”." },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; motivo?: string }> }) {
  const { next, motivo } = await searchParams;
  const reason = motivo ? REASONS[motivo] : undefined;
  return (
    <div className="grid gap-6">
      <div className="grid gap-1.5">
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="text-sm text-muted-foreground">Use o e-mail do seu convite. O acesso é liberado pelo administrador.</p>
      </div>
      {reason && <FormAlert tone={reason.tone}>{reason.text}</FormAlert>}
      <LoginForm next={next} />
    </div>
  );
}
