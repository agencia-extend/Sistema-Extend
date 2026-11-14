import Link from "next/link";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { REQUEST_KIND_SHORT, REQUEST_STATUS_LABEL, isOpen } from "@/domain/privacy";
import { dayLabel } from "@/domain/trainings";
import { formatDate } from "@/domain/shared/dates";
import type { PrivacyRequestRow } from "@/features/privacy/queries";
import { RequestDialog } from "./request-dialog";

/** Meu perfil → Privacidade: baixar meus dados, fazer pedidos e acompanhar as respostas. */
export function MyPrivacy({ requests }: { requests: PrivacyRequestRow[] }) {
  return (
    <section id="privacidade" aria-labelledby="privacidade-t" className="grid scroll-mt-20 gap-4">
      <div className="grid gap-1">
        <h2 id="privacidade-t" className="text-base font-semibold">Privacidade</h2>
        <p className="text-sm text-muted-foreground">
          Veja como seus dados são usados na{" "}
          <Link href="/privacidade" className="font-medium text-brand underline underline-offset-2">Política de Privacidade</Link>. Você pode baixar uma cópia deles agora ou fazer um pedido.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href="/api/meus-dados" download><Download aria-hidden="true" /> Baixar meus dados</a>
        </Button>
        <RequestDialog />
      </div>

      {requests.length > 0 && (
        <ul aria-label="Meus pedidos" className="divide-y rounded-xl border bg-card">
          {requests.map((r) => (
            <li key={r.id} className="grid gap-1.5 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{REQUEST_KIND_SHORT[r.kind]}</span>
                <Badge variant={isOpen(r.status) ? "secondary" : "outline"}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground tabular">
                Enviado em {formatDate(r.createdAt)}
                {isOpen(r.status) ? `. Resposta até ${dayLabel(r.dueOn)}.` : "."}
              </p>
              {r.response && <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm leading-6 break-words whitespace-pre-line">{r.response}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
