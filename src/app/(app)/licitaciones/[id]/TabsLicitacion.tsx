import Link from "next/link";
import { TABS_LICITACION, type TabLicitacion } from "@/lib/licitaciones/preparacion";

export function TabsLicitacion({
  licitacionId,
  activa,
  conteos,
}: {
  licitacionId: string;
  activa: TabLicitacion;
  conteos: Partial<Record<TabLicitacion, number | string>>;
}) {
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Secciones de la licitación">
      {TABS_LICITACION.map((t) => {
        const activo = t.id === activa;
        const conteo = conteos[t.id];
        return (
          <Link
            key={t.id}
            href={`/licitaciones/${licitacionId}?tab=${t.id}`}
            aria-current={activo ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activo
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            {t.etiqueta}
            {conteo != null && conteo !== 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${activo ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                {conteo}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
