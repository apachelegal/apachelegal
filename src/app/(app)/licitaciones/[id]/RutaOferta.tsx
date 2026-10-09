import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { EstadoPaso, PasoRuta } from "@/lib/licitaciones/preparacion";

const ESTILO: Record<EstadoPaso, { circulo: string; texto: string; barra: string }> = {
  completo: { circulo: "bg-emerald-500 text-white", texto: "text-slate-900", barra: "bg-emerald-500" },
  en_curso: { circulo: "bg-blue-600 text-white", texto: "text-slate-900", barra: "bg-blue-500" },
  pendiente: { circulo: "bg-slate-200 text-slate-500", texto: "text-slate-500", barra: "bg-slate-200" },
};

export function RutaOferta({
  licitacionId,
  pasos,
  porcentaje,
  siguiente,
}: {
  licitacionId: string;
  pasos: PasoRuta[];
  porcentaje: number;
  siguiente: PasoRuta | null;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Ruta de la oferta</h2>
          <p className="text-xs text-slate-500">Lo que falta para tener lista la propuesta.</p>
        </div>
        {siguiente ? (
          <Link
            href={`/licitaciones/${licitacionId}?tab=${siguiente.tab}`}
            className="group flex w-full max-w-xl items-center gap-3 rounded-xl bg-blue-50 px-4 py-2.5 text-sm text-blue-900 hover:bg-blue-100 sm:w-auto"
          >
            <span className="min-w-0">
              <span className="block text-xs font-medium uppercase tracking-wide text-blue-600">Siguiente paso</span>
              <span className="block sm:truncate">{siguiente.accion}</span>
            </span>
            <ArrowRight size={16} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <span className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
            Todos los pasos están completos
          </span>
        )}
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {pasos.map((p, i) => {
          const e = ESTILO[p.estado];
          return (
            <li key={p.id}>
              <Link
                href={`/licitaciones/${licitacionId}?tab=${p.tab}`}
                className="block h-full rounded-xl border border-slate-200 p-3 transition-colors hover:border-blue-300 hover:bg-slate-50"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${e.circulo}`}>
                    {p.estado === "completo" ? <Check size={14} /> : i + 1}
                  </span>
                  <span className={`text-sm font-medium leading-tight ${e.texto}`}>{p.titulo}</span>
                </div>
                <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${e.barra}`} style={{ width: `${Math.round(p.fraccion * 100)}%` }} />
                </div>
                <p className="text-xs leading-snug text-slate-500">{p.detalle}</p>
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-right text-xs text-slate-400">Preparación general: {porcentaje}%</p>
    </section>
  );
}
