import {
  BarChart3,
  BellRing,
  MessageCircle,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  FileBarChart,
  GraduationCap,
  House,
  Kanban,
  LayoutList,
  ListChecks,
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
  weekly: FileBarChart,
  schedule: CalendarCheck,
  tasks: LayoutList,
  clients: Users,
  creatives: Palette,
  ads: Megaphone,
  alerts: BellRing,
  inbox: MessageCircle,
  reports: TriangleAlert,
  calendar: CalendarDays,
  commercial: Briefcase,
  dashboard: BarChart3,
  boards: Kanban,
  production: ClipboardCheck,
  training: GraduationCap,
  playbook: ListChecks,
  settings: Settings,
};

export function NavIcon({ icon, className }: { icon: NavIconKey; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden="true" />;
}
