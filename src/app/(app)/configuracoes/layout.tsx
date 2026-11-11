import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/dal";
import { visibleSettingsPages } from "@/config/navigation";
import { SettingsNav } from "./settings-nav";

export default async function ConfiguracoesLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const pages = visibleSettingsPages(user.permissions).map(({ href, label }) => ({ href, label }));
  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <SettingsNav pages={pages} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
