"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavGroup } from "@/config/navigation";
import { NavIcon } from "@/components/app/nav-icon";
import { cn } from "@/lib/utils";

/**
 * Lista de navegação da barra lateral. Usada no layout e no "Ver como"
 * (preview=true desliga os links para a pré-visualização ser só leitura).
 */
export function SidebarNav({
  groups,
  showSettings,
  preview = false,
  onNavigate,
}: {
  groups: NavGroup[];
  showSettings: boolean;
  preview?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => !preview && (pathname === href || pathname.startsWith(`${href}/`));

  const item = (href: string, label: string, icon: Parameters<typeof NavIcon>[0]["icon"]) => {
    const active = isActive(href);
    const cls = cn(
      "group relative flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
      active ? "bg-night-raised text-white" : "text-night-dim hover:bg-night-raised/60 hover:text-night-text",
    );
    const content = (
      <>
        <span
          className={cn("absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-brand transition-opacity", active ? "opacity-100" : "opacity-0")}
          aria-hidden="true"
        />
        <NavIcon icon={icon} className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </>
    );
    if (preview) return <div className={cls}>{content}</div>;
    return (
      <Link href={href} className={cls} aria-current={active ? "page" : undefined} onClick={onNavigate}>
        {content}
      </Link>
    );
  };

  return (
    <nav aria-label="Menu principal" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g.label} className="grid gap-0.5">
          <p className="px-3 pb-1 text-xs font-medium text-night-dim/80">{g.label}</p>
          {g.items.map((i) => (
            <div key={i.href}>{item(i.href, i.label, i.icon)}</div>
          ))}
        </div>
      ))}
      {showSettings && <div className="mt-auto grid gap-0.5 border-t border-night-line pt-3">{item("/configuracoes", "Configurações", "settings")}</div>}
    </nav>
  );
}
