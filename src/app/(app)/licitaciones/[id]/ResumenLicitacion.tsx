import { CalendarDays, FileText, NotebookText } from "lucide-react";
import { formatDate } from "@/lib/format";
import { diasHasta } from "@/lib/licitaciones/preparacion";
import type { AnalisisLicitacion, Licitacion } from "@/lib/types";

const RESUMEN_CORTO = 420;

export function ResumenLicitacion({ lic, analisis }: { lic: Licitacion; analisis: AnalisisLicitacion | null }) {
  const fechas = (analisis?.fechas_clave ?? [])
    .filter((f) => f.fecha)
    .sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));
  const notas = lic.notas?.trim() ?? "";

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="flex flex-col gap-5 lg:col-span-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileText size={16} className="text-blue-600" />
            De qué trata
          </h2>
          {analisis?.resumen ? (
            <p className="text-sm leading-relaxed text-slate-700">{analisis.resumen}</p>
          ) : (
            <p className="text-sm text-slate-400">
              Aún no hay resumen. Sube el pliego en la pestaña Requisitos y analízalo con IA para ver aquí el resumen del
              proceso.
            </p>
          )}
          {lic.responsable && (
            <p className="mt-3 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Responsable:</span> {lic.responsable}
            </p>
          )}
        </section>

        {notas && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <NotebookText size={16} className="text-blue-600" />
              Notas del equipo
            </h2>
            {notas.length <= RESUMEN_CORTO ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{notas}</p>
            ) : (
              <details className="group">
                <summary className="cursor-pointer list-none text-sm leading-relaxed text-slate-700">
                  <span className="whitespace-pre-line">{notas.slice(0, RESUMEN_CORTO)}…</span>{" "}
                  <span className="font-medium text-blue-600 group-open:hidden">Ver todo</span>
                </summary>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{notas.slice(RESUMEN_CORTO)}</p>
                <p className="mt-2 hidden text-xs font-medium text-blue-600 group-open:block">Se muestra todo el texto.</p>
              </details>
            )}
          </section>
        )}
      </div>

      <aside className="flex flex-col gap-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarDays size={16} className="text-blue-600" />
            Fechas clave
          </h2>
          {fechas.length === 0 ? (
            <p className="text-sm text-slate-400">Se llenan al analizar el pliego.</p>
          ) : (
            <ul className="space-y-2.5">
              {fechas.slice(0, 10).map((f) => {
                const d = diasHasta(f.fecha ?? null);
                return (
                  <li key={`${f.evento}-${f.fecha}`} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-slate-700">{f.evento}</span>
                    <span className="shrink-0 text-right">
                      <span className="block font-medium text-slate-900">{formatDate(f.fecha ?? null)}</span>
                      {d != null && (
                        <span className={`text-xs ${d < 0 ? "text-slate-400" : d <= 7 ? "font-medium text-amber-600" : "text-slate-400"}`}>
                          {d < 0 ? "pasó" : d === 0 ? "hoy" : `en ${d} d`}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
