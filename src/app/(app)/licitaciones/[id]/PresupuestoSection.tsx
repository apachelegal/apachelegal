import { Calculator, AlertTriangle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCOP } from "@/lib/format";
import { analizarPresupuesto } from "@/lib/presupuesto/analisis";
import type { PresupuestoItem, PresupuestoResumen } from "@/lib/types";
import { PresupuestoTabla } from "./PresupuestoTabla";
import { MargenSection } from "./MargenSection";
import { CotizacionesSection } from "./CotizacionesSection";
import { armarListaCotizacion } from "@/lib/presupuesto/cotizar";
import { supuestosDesdeResumen } from "@/lib/presupuesto/margen";

const ETIQUETA_SECCION: Record<string, string> = {
  obra: "Obra",
  suministro: "Suministros",
  movilidad: "Movilidad / PMT",
  otros: "Otros",
};

const pct = (n: number) => `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;

export async function PresupuestoSection({ licitacionId }: { licitacionId: string }) {
  const supabase = createAdminClient();
  const [itemsRes, resumenRes] = await Promise.all([
    supabase
      .from("presupuesto_items")
      .select("*")
      .eq("licitacion_id", licitacionId)
      .order("orden", { ascending: true })
      .limit(5000),
    supabase.from("presupuesto_resumen").select("*").eq("licitacion_id", licitacionId).maybeSingle(),
  ]);

  const encabezado = (
    <h2 className="mb-4 flex items-center gap-2 font-medium text-slate-900">
      <Calculator size={18} className="text-blue-600" />
      Presupuesto oficial
    </h2>
  );

  if (itemsRes.error) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {encabezado}
        <p className="text-sm text-slate-500">
          Todavía no está disponible la sección de presupuesto. Falta aplicar la migración de presupuesto en la base
          de datos (final de <code>supabase/schema.sql</code>).
        </p>
      </div>
    );
  }

  const items = (itemsRes.data ?? []) as PresupuestoItem[];
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {encabezado}
        <p className="text-sm text-slate-400">
          Esta licitación aún no tiene presupuesto cargado. Al cargarlo, aquí se compara ítem por ítem contra los
          precios de referencia de la entidad.
        </p>
      </div>
    );
  }

  const resumen = (resumenRes.data ?? null) as PresupuestoResumen | null;
  const a = analizarPresupuesto(items);
  const lineas = resumen?.resumen.lineas ?? [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      {encabezado}
      <p className="mb-4 text-xs text-slate-500">
        {resumen?.fuente ?? "Presupuesto oficial"}
        {resumen?.vigencia_precios ? ` · precios de referencia: ${resumen.vigencia_precios}` : ""}
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {a.porSeccion.map((s) => (
          <div key={s.seccion} className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">{ETIQUETA_SECCION[s.seccion]} (costo directo)</p>
            <p className="text-base font-semibold text-slate-900">{formatCOP(s.valor)}</p>
            <p className="text-xs text-slate-400">{s.items} ítems</p>
          </div>
        ))}
        {resumen?.resumen.total_oficial != null && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-700">Total oficial (con AIU, IVA y demás)</p>
            <p className="text-base font-semibold text-blue-900">{formatCOP(resumen.resumen.total_oficial)}</p>
          </div>
        )}
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Comparación con precios de referencia (obra)</h3>
          <ul className="space-y-1.5 text-sm">
            {a.cobertura.map((c) => (
              <li key={c.coincidencia} className="flex items-center justify-between gap-3">
                <span className="text-slate-600">
                  {c.coincidencia === "exacta"
                    ? "Con código SAE"
                    : c.coincidencia === "similar"
                      ? "Descripción similar a un ítem SAE"
                      : "Sin referencia SAE (precio propio o no previsto)"}
                </span>
                <span className="shrink-0 font-medium text-slate-900">
                  {c.items} ítems · {pct(c.porcentaje)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            {a.preciosDistintos.length === 0
              ? "Todos los ítems con código SAE tienen el mismo precio y unidad que el catálogo."
              : `${a.preciosDistintos.length} ítem(s) con código SAE tienen un precio o unidad distintos del catálogo; revísalos abajo.`}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Rango de oferta de la obra</h3>
          <p className="text-xs text-slate-500">
            Cada precio unitario ofertado debe estar entre el 90% y el 100% del precio oficial del ítem, o se rechaza
            la oferta.
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Techo: <span className="font-medium">{formatCOP(a.rangoObra.techo)}</span> · Piso:{" "}
            <span className="font-medium">{formatCOP(a.rangoObra.piso)}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Los 10 ítems más grandes concentran {pct(a.concentracionTop10.porcentaje)} de la obra: ahí se define la
            oferta.
          </p>
        </div>
      </div>

      {a.sinZanja.items.length > 0 && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="mb-1 flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle size={15} /> Tramos sin zanja en el presupuesto
          </p>
          <p className="text-xs text-amber-900">
            {a.sinZanja.items.length} ítem(s) por {formatCOP(a.sinZanja.valor)} ({pct(a.sinZanja.porcentajeObra)} de la
            obra) corresponden a instalación sin zanja (hincado, microtúnel, pipe ramming o sus pozos). Están
            relacionados con la actividad de experiencia sin zanja que exige el pliego.
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-900">
            {a.sinZanja.items
              .sort((x, y) => (y.total ?? 0) - (x.total ?? 0))
              .slice(0, 4)
              .map((i) => (
                <li key={i.id}>
                  {i.codigo}: {i.descripcion.slice(0, 110)}
                  {i.descripcion.length > 110 ? "…" : ""} — {formatCOP(i.total)}
                  {i.cantidad != null && ` (${i.cantidad.toLocaleString("es-CO")} ${i.unidad ?? ""})`}
                </li>
              ))}
          </ul>
        </div>
      )}

      {lineas.length > 0 && (
        <div className="mb-5 rounded-lg border border-slate-200">
          <h3 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
            Resumen oficial (AIU, impacto urbano y totales)
          </h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {lineas.map((l) => (
                <tr key={l.etiqueta} className={l.grupo === "total" ? "bg-slate-50 font-semibold" : ""}>
                  <td className="px-4 py-1.5 text-slate-600">
                    {l.etiqueta}
                    {l.porcentaje != null ? ` (${l.porcentaje.toLocaleString("es-CO")}%)` : ""}
                  </td>
                  <td className="px-4 py-1.5 text-right text-slate-900">{formatCOP(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {resumen?.resumen.vigencias && resumen.resumen.vigencias.length > 0 && (
            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
              Vigencias:{" "}
              {resumen.resumen.vigencias.map((v) => `${v.anio}: ${formatCOP(v.valor)}`).join(" · ")}
            </p>
          )}
        </div>
      )}

      {resumen?.resumen.notas && resumen.resumen.notas.length > 0 && (
        <ul className="mb-5 list-disc space-y-0.5 pl-5 text-xs text-slate-500">
          {resumen.resumen.notas.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <div className="mb-5">
        <CotizacionesSection licitacionId={licitacionId} lista={armarListaCotizacion(items)} />
      </div>

      <PresupuestoTabla items={items} />

      <div className="mt-5">
        <MargenSection
          licitacionId={licitacionId}
          items={items}
          supuestosIniciales={
            resumen?.supuestos && Object.keys(resumen.supuestos).length
              ? resumen.supuestos
              : supuestosDesdeResumen(resumen?.resumen as Parameters<typeof supuestosDesdeResumen>[0])
          }
        />
      </div>
    </div>
  );
}
