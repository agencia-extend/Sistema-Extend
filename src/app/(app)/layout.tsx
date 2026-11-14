import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { visibleNavGroups, visibleSettingsPages } from "@/config/navigation";
import { myRunningTimer } from "@/features/tasks/queries";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ count }, timer] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    myRunningTimer(user.id),
  ]);

  const groups = visibleNavGroups(user.permissions);
  const settings = visibleSettingsPages(user.permissions);
  const searchPages = [
    ...groups.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label }))),
    ...settings.map((s) => ({ href: s.href, label: `Configurações: ${s.label}` })),
  ];

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.fullName,
        email: user.email,
        roleName: user.roles.map((r) => r.name).join(", ") || "Sem papel",
        canManageUsers: Boolean(user.permissions["users.manage"]),
      }}
      groups={groups}
      showSettings
      searchPages={searchPages}
      unread={count ?? 0}
      timer={timer}
    >
      {children}
    </AppShell>
  );
}
