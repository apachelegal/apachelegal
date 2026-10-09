"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GRUPOS_NAV } from "./Sidebar";

export function MobileNav() {
  const pathname = usePathname();
  const items = GRUPOS_NAV.flatMap((g) => g.items);
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden" aria-label="Navegación principal">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
              active ? "bg-blue-50 text-blue-700" : "text-slate-600"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
