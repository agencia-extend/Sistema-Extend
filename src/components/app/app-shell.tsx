"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Menu, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { NavGroup } from "@/config/navigation";
import { NavIcon } from "@/components/app/nav-icon";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { GlobalSearch, type SearchPage } from "@/components/app/global-search";
import { UserMenu } from "@/components/app/user-menu";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { cn } from "@/lib/utils";

type ShellUser = { id: string; name: string; email: string; roleName: string; canManageUsers: boolean };

function Brand() {
  return (
    <Link href="/inicio" className="flex h-16 shrink-0 items-center px-6" aria-label="Extend: ir para o início">
      <Image src="/brand/logo.png" alt="" width={140} height={27} className="h-7 w-auto" priority />
    </Link>
  );
}

export function AppShell({
  user,
  groups,
  showSettings,
  searchPages,
  unread,
  timer,
  children,
}: {
  user: ShellUser;
  groups: NavGroup[];
  showSettings: boolean;
  searchPages: SearchPage[];
  unread: number;
  timer: { taskId: string; title: string; startedAt: string } | null;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const mobileItems = groups.flatMap((g) => g.items).filter((i) => i.mobile).slice(0, 4);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#conteudo" className="sr-only z-50 rounded bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col bg-night md:flex">
        <Brand />
        <SidebarNav groups={groups} showSettings={showSettings} />
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="size-10 md:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
            <Menu />
          </Button>
          <Link href="/inicio" className="md:hidden" aria-label="Extend: ir para o início">
            <Image src="/brand/mark.png" alt="" width={40} height={20} className="h-5 w-auto" />
          </Link>
          <div className="flex flex-1 justify-end md:justify-start">
            <GlobalSearch pages={searchPages} canManageUsers={user.canManageUsers} />
          </div>
          {timer && (
            <Link
              href={`/tarefas/${timer.taskId}`}
              className="inline-flex h-10 max-w-48 items-center gap-1.5 rounded-full border border-success/40 bg-success-soft px-3 text-sm text-success"
              title={`Cronômetro ligado: ${timer.title}`}
            >
              <Timer className="size-4 shrink-0 animate-pulse" aria-hidden="true" />
              <span className="truncate max-sm:sr-only">{timer.title}</span>
            </Link>
          )}
          <NotificationBell userId={user.id} initialUnread={unread} />
          <UserMenu name={user.name} email={user.email} roleName={user.roleName} />
        </header>

        <main id="conteudo" className="flex-1 pb-20 md:pb-0">
          {children}
        </main>

        {mobileItems.length > 0 && (
          <nav aria-label="Atalhos" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden">
            <ul className="grid" style={{ gridTemplateColumns: `repeat(${mobileItems.length + 1}, minmax(0, 1fr))` }}>
              {mobileItems.map((i) => {
                const active = pathname === i.href || pathname.startsWith(`${i.href}/`);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      <NavIcon icon={i.icon} className="size-5" />
                      {i.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  <Menu className="size-5" aria-hidden="true" />
                  Menu
                </button>
              </li>
            </ul>
          </nav>
        )}
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-72 flex-col border-night-line bg-night p-0 text-night-text">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Brand />
          <SidebarNav groups={groups} showSettings={showSettings} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
