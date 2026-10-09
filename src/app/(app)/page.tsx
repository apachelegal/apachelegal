import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, FolderCheck, Gavel, ListChecks, Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { EstadoBadge } from "@/components/EstadoBadge";
import { formatCOP, formatDate } from "@/lib/format";
import { diasHasta } from "@/lib/licitaciones/preparacion";
import { cargarHabilitacionEmpresas, cargarResumenes } from "@/lib/licitaciones/resumenes";
import { hoyISO } from "@/lib/habilitacion/checklist";
import type { Licitacion } from "@/lib/types";

const ACTIVAS = ["en_estudio", "en_elaboracion", "presentada"];

async function getDatos() {
  try {
    const supabase = createAdminClient();
    const [{ data: licitaciones, error }, { data: tareas }, habilitacion] = await Promise.all([
      supabase.from("licitaciones").select("*"),
      supabase.from("tareas").select("id, licitacion_id, titulo, estado, fecha_limite").neq("estado", "completada").not("fecha_limite", "is", null),
      cargarHabilitacionEmpresas(),
    ]);
    if (error) throw error;
    return { connected: true, licitaciones: (licitaciones ?? []) as Licitacion[], tareas: tareas ?? [], habilitacion };
  } catch {
    return { connected: false, licitaciones: [] as Licitacion[], tareas: [], habilitacion: [] };
  }
}

function Kpi({
  icono,
  etiqueta,
  valor,
  detalle,
  alerta,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  valor: string | number;
  detalle: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-slate-500">
        <span className="text-xs font-medium uppercase tracking-wide">{etiqueta}</span>
        <span className={alerta ? "text-red-500" : "text-blue-600"}>{icono}</span>
      </div>
      <p className={`text-3xl font-semibold ${alerta ? "text-red-600" : "text-slate-900"}`}>{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{detalle}</p>
    </div>
  );
}

export default async function Home() {
  const { connected, licitaciones, tareas, habilitacion } = await getDatos();
  const hoy = hoyISO();

  const activas = licitaciones
    .filter((l) => ACTIVAS.includes(l.estado))
    .sort((a, b) => {
      const fa = a.fecha_cierre ?? a.fecha_vencimiento;
      const fb = b.fecha_cierre ?? b.fecha_vencimiento;
      if (fa && fb) return fa.localeCompare(fb);
      return fa ? -1 : fb ? 1 : 0;
    });
  const resumenes = await cargarResumenes(activas);
  const titulos = new Map(licitaciones.map((l) => [l.id, l]));
  const idsActivas = new Set(activas.map((l) => l.id));
  const tareasActivas = tareas.filter((t) => idsActivas.has(t.licitacion_id as string));

  const cierresProximos = activas.filter((l) => {
    const d = diasHasta(l.fecha_cierre ?? l.fecha_vencimiento);
    return d != null && d >= 0 && d <= 30;
  });
  const vencidas = tareasActivas.filter((t) => (t.fecha_limite as string) < hoy);
  const proximas7 = tareasActivas.filter((t) => (t.fecha_limite as string) >= hoy && (diasHasta(t.fecha_limite as string) ?? 99) <= 7);
  const grupo = habilitacion.filter((h) => h.empresa.categoria === "grupo");
  const listas = grupo.filter((h) => (h.global ?? 0) >= 80).length;
  const atencion = [...vencidas, ...proximas7].sort((a, b) => (a.fecha_limite as string).localeCompare(b.fecha_limite as string)).slice(0, 8);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Panel</h1>
          <p className="text-sm text-slate-500">Qué está en juego hoy y qué falta para presentar cada oferta.</p>
        </div>
        <Link
          href="/licitaciones/nueva"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Plus size={16} />
          Nueva licitación
        </Link>
      </div>

      {!connected && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Supabase no está conectado todavía. Configura <code className="rounded bg-amber-100 px-1 py-0.5">.env.local</code>{" "}
          con tus credenciales y ejecuta <code className="rounded bg-amber-100 px-1 py-0.5">supabase/schema.sql</code>.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icono={<Gavel size={18} />} etiqueta="Licitaciones activas" valor={activas.length} detalle={`${licitaciones.length} en total`} />
        <Kpi
          icono={<CalendarClock size={18} />}
          etiqueta="Cierran en 30 días"
          valor={cierresProximos.length}
          detalle={cierresProximos.length ? "Revisa su preparación abajo" : "Sin cierres próximos"}
        />
        <Kpi
          icono={<ListChecks size={18} />}
          etiqueta="Tareas vencidas"
          valor={vencidas.length}
          detalle={`${proximas7.length} más vencen esta semana`}
          alerta={vencidas.length > 0}
        />
        <Kpi
          icono={<FolderCheck size={18} />}
          etiqueta="Empresas listas"
          valor={`${listas}/${grupo.length}`}
          detalle="Carpeta de habilitación al 80% o más"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Licitaciones activas</h2>
            <Link href="/licitaciones" className="text-xs font-medium text-blue-600 hover:underline">
              Ver todas
            </Link>
          </div>
          {activas.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No hay licitaciones activas.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activas.slice(0, 7).map((l) => {
                const r = resumenes.get(l.id);
                const fecha = l.fecha_cierre ?? l.fecha_vencimiento;
                const d = diasHasta(fecha);
                const p = r?.porcentaje ?? 0;
                return (
                  <li key={l.id}>
                    <Link href={`/licitaciones/${l.id}`} className="group flex min-w-0 items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-2">
                          <EstadoBadge estado={l.estado} />
                          <span className="truncate text-xs text-slate-500">{l.numero_proceso ?? l.entidad}</span>
                        </div>
                        <p className="truncate text-sm font-medium text-slate-900">{l.objeto}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {formatCOP(l.presupuesto)}
                          {r?.siguiente && <> · Siguiente: {r.siguiente.titulo}</>}
                        </p>
                      </div>
                      <div className="hidden w-32 shrink-0 sm:block">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-500">{p}%</span>
                          <span className={d != null && d < 0 ? "text-red-600" : d != null && d <= 7 ? "font-medium text-amber-600" : "text-slate-400"}>
                            {d == null ? "sin fecha" : d < 0 ? "cerró" : d === 0 ? "hoy" : `${d} d`}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${p >= 80 ? "bg-emerald-500" : p >= 40 ? "bg-blue-500" : "bg-amber-500"}`} style={{ width: `${p}%` }} />
                        </div>
                        {fecha && <p className="mt-1 text-right text-xs text-slate-400">{formatDate(fecha)}</p>}
                      </div>
                      <ArrowRight size={16} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-900">Requiere atención</h2>
            {atencion.length === 0 ? (
              <p className="p-5 text-sm text-slate-400">Sin tareas vencidas ni por vencer esta semana.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {atencion.map((t) => {
                  const lic = titulos.get(t.licitacion_id as string);
                  const vencida = (t.fecha_limite as string) < hoy;
                  return (
                    <li key={t.id as string}>
                      <Link href={`/licitaciones/${t.licitacion_id}?tab=cronograma`} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
                        <AlertTriangle size={15} className={`mt-0.5 shrink-0 ${vencida ? "text-red-500" : "text-amber-500"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-800">{t.titulo as string}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {lic?.numero_proceso ?? lic?.entidad} · {vencida ? "venció" : "vence"} {formatDate(t.fecha_limite as string)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Habilitación del grupo</h2>
              <Link href="/habilitacion" className="text-xs font-medium text-blue-600 hover:underline">
                Ver detalle
              </Link>
            </div>
            <ul className="divide-y divide-slate-100">
              {grupo.map((h) => (
                <li key={h.empresa.id}>
                  <Link href={`/empresas/${h.empresa.id}#carpeta`} className="block px-5 py-2.5 hover:bg-slate-50">
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-slate-800">{h.empresa.nombre}</span>
                      <span className="shrink-0 text-xs text-slate-500">{h.global ?? 0}%</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${(h.global ?? 0) >= 80 ? "bg-emerald-500" : (h.global ?? 0) >= 40 ? "bg-blue-500" : "bg-amber-500"}`}
                        style={{ width: `${h.global ?? 0}%` }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
