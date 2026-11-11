import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/dal";
import { listSectors, listUsers } from "@/features/admin/queries";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { SectorDialog } from "./sector-dialog";

export const metadata: Metadata = { title: "Setores" };

const AREA = { gestao: "Gestão", trafego: "Tráfego", criacao: "Criação de conteúdo" } as const;

export default async function SetoresPage() {
  await requirePermission("settings.manage");
  const [sectors, users] = await Promise.all([listSectors(), listUsers()]);
  const peopleBySector = new Map<string, string[]>();
  for (const u of users.filter((x) => x.is_active)) {
    for (const s of u.sectors) peopleBySector.set(s.id, [...(peopleBySector.get(s.id) ?? []), u.full_name || u.email]);
  }

  return (
    <>
      <PageHeader
        title="Setores"
        description="Setores organizam a visão do setor e o alcance “do meu setor”. Quem faz parte de cada um é definido na página do usuário."
        actions={<SectorDialog />}
      />
      <PageBody>
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {sectors.map((s) => {
            const people = peopleBySector.get(s.id) ?? [];
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="size-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                <div className="grid min-w-0 flex-1 basis-56 gap-0.5">
                  <p className="text-sm font-medium">
                    {s.name} {!s.is_active && <Badge variant="outline">Inativo</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {AREA[s.area]} · {people.length ? people.join(", ") : "ninguém ainda"}
                  </p>
                </div>
                <SectorDialog sector={{ id: s.id, name: s.name, area: s.area, color: s.color, isActive: s.is_active }} />
              </li>
            );
          })}
        </ul>
      </PageBody>
    </>
  );
}
