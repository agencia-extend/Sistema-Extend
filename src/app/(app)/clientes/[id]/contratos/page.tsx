import { FileSignature, Pencil, RefreshCw } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { getClient, listContracts } from "@/features/clients/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContractDialog } from "@/features/clients/components/contract-dialog";
import { Section } from "@/features/clients/components/section";
import { contractWindow, type ContractWindow } from "@/domain/clients";
import { centsToInput, formatBRL } from "@/domain/shared/money";

const feeInput = (cents: number | null) => (cents === null ? "" : centsToInput(cents));
import { dayLabel } from "@/domain/trainings";
import { todayKey } from "@/domain/media";
import { cn } from "@/lib/utils";
import { DeleteContractButton } from "./delete-contract";

const NOTE: Record<ContractWindow, string> = { vencido: "Venceu sem renovação", termina_logo: "Termina em até 7 dias", termina: "Termina em até 30 dias", ok: "", sem: "" };

/** Dia seguinte e mesma duração do contrato atual: sugestão para a renovação. */
function renewalDraft(startsOn: string, endsOn: string | null) {
  if (!endsOn) return { startsOn: "", endsOn: "" };
  const s = new Date(`${endsOn}T00:00:00Z`);
  s.setUTCDate(s.getUTCDate() + 1);
  const months = Math.max(1, Math.round((Date.parse(endsOn) - Date.parse(startsOn)) / (30.44 * 86_400_000)));
  const e = new Date(s);
  e.setUTCMonth(e.getUTCMonth() + months);
  e.setUTCDate(e.getUTCDate() - 1);
  return { startsOn: s.toISOString().slice(0, 10), endsOn: e.toISOString().slice(0, 10) };
}

export default async function ContratosPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("clients.read");
  const { id } = await params;
  const [client, contracts] = await Promise.all([getClient(id), listContracts(id)]);
  const canManage = Boolean(user.permissions["clients.manage"] || user.permissions["clients.onboarding.manage"]);
  const showValues = Boolean(user.permissions["clients.onboarding.read"]);
  const today = todayKey(new Date());
  const current = contracts[0];
  const window = current ? contractWindow(current.endsOn, today) : "sem";

  return (
    <div className="grid max-w-4xl gap-6">
      <Section
        title="Contratos"
        action={
          canManage ? (
            current ? (
              <ContractDialog
                clientId={id}
                showValues={showValues}
                title="Renovar contrato"
                description="O contrato novo começa depois do fim do atual. O anterior fica guardado no histórico."
                trigger={<Button size="sm"><RefreshCw aria-hidden="true" /> Renovar contrato</Button>}
                initial={{ ...renewalDraft(current.startsOn, current.endsOn), scopeText: current.scopeText ?? client?.scope_text ?? "", fee: feeInput(current.feeCents), notes: "" }}
              />
            ) : (
              <ContractDialog
                clientId={id}
                showValues={showValues}
                title="Registrar contrato"
                description="Datas, escopo e valor do contrato com o cliente."
                trigger={<Button size="sm"><FileSignature aria-hidden="true" /> Registrar contrato</Button>}
                initial={{ startsOn: client?.contract_start ?? today, endsOn: "", scopeText: client?.scope_text ?? "", fee: "", notes: "" }}
              />
            )
          ) : undefined
        }
      >
        {contracts.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-surface px-4 py-6 text-sm text-muted-foreground">
            {canManage ? "Nenhum contrato registrado. Registre as datas e o escopo para o sistema avisar quando estiver perto do fim." : "Nenhum contrato registrado ainda."}
          </p>
        ) : (
          <ol className="grid gap-3" aria-label="Histórico de contratos">
            {contracts.map((c, i) => {
              const w = i === 0 ? window : "ok";
              const label = i === 0 ? (c.startsOn > today ? "Começa em breve" : "Atual") : "Encerrado";
              return (
                <li key={c.id} className={cn("grid gap-2 rounded-xl border bg-card p-4", i === 0 && "border-brand/40")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold tabular">{dayLabel(c.startsOn)} a {c.endsOn ? dayLabel(c.endsOn) : "sem data de fim"}</span>
                      <Badge variant={i === 0 ? "default" : "secondary"}>{label}</Badge>
                      {NOTE[w] && <span className={cn("text-xs font-medium", w === "termina" ? "text-warning" : "text-danger")}>{NOTE[w]}</span>}
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        <ContractDialog
                          clientId={id}
                          showValues={showValues}
                          title="Editar contrato"
                          description="Corrija datas, escopo ou valor deste contrato."
                          trigger={<Button variant="ghost" size="icon" aria-label={`Editar o contrato de ${dayLabel(c.startsOn)}`}><Pencil /></Button>}
                          initial={{ id: c.id, startsOn: c.startsOn, endsOn: c.endsOn ?? "", scopeText: c.scopeText ?? "", fee: feeInput(c.feeCents), notes: c.notes ?? "" }}
                        />
                        {contracts.length > 1 && <DeleteContractButton id={c.id} clientId={id} label={dayLabel(c.startsOn)} />}
                      </div>
                    )}
                  </div>
                  <dl className="grid gap-1 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs text-muted-foreground">Escopo</dt><dd className="break-words">{c.scopeText || "—"}</dd></div>
                    {showValues && <div><dt className="text-xs text-muted-foreground">Mensalidade</dt><dd className="tabular">{formatBRL(c.feeCents)}</dd></div>}
                  </dl>
                  {c.notes && <p className="text-sm break-words whitespace-pre-line text-muted-foreground">{c.notes}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </Section>
      <p className="text-xs text-muted-foreground">O sistema avisa o responsável pela comunicação e a coordenação 30 e 7 dias antes do fim do contrato atual, e no dia seguinte se ele vencer sem renovação.</p>
    </div>
  );
}
