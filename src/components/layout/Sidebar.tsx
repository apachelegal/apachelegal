"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Gavel,
  FileText,
  Sparkles,
  BarChart3,
  Settings,
  Building2,
  Landmark,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/procesos", label: "Procesos", icon: Briefcase },
  { href: "/licitaciones", label: "Licitaciones", icon: Gavel },
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/entidades", label: "Entidades", icon: Landmark },
  { href: "/documentos", label: "Documentos", icon: FileText },
  { href: "/ia-juridica", label: "IA Jurídica", icon: Sparkles },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/admin", label: "Admin", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6">
        <span className="text-lg font-semibold tracking-tight text-slate-900">
          Apache<span className="text-blue-600">Legal</span>
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon size={18} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
