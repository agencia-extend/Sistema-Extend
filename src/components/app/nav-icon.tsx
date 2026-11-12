import {
  BarChart3,
  Briefcase,
  CalendarDays,
  House,
  Kanban,
  LayoutList,
  Megaphone,
  Palette,
  Settings,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIcon as NavIconKey } from "@/config/navigation";

const ICONS: Record<NavIconKey, LucideIcon> = {
  home: House,
  tasks: LayoutList,
  clients: Users,
  creatives: Palette,
  ads: Megaphone,
  reports: TriangleAlert,
  calendar: CalendarDays,
  commercial: Briefcase,
  dashboard: BarChart3,
  boards: Kanban,
  settings: Settings,
};

export function NavIcon({ icon, className }: { icon: NavIconKey; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden="true" />;
}
