"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/control", label: "Tablero" },
  { href: "/control/simulador", label: "Simulador de consorcio" },
  { href: "/control/solicitudes", label: "Solicitudes" },
];

export function ControlTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-slate-200">
      {TABS.map((t) => {
        const activa = t.href === "/control" ? pathname === "/control" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activa ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              activa ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
