import Link from "next/link";
import { ArrowRight, CalendarClock, Plus, Search } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { EstadoBadge } from "@/components/EstadoBadge";
import { formatCOP, formatDate } from "@/lib/format";
import { diasHasta } from "@/lib/licitaciones/preparacion";
import { cargarResumenes } from "@/lib/licitaciones/resumenes";
import { ESTADO_LABELS, type EstadoLicitacion, type Licitacion } from "@/lib/types";

const ESTADOS = Object.keys(ESTADO_LABELS) as EstadoLicitacion[];

async function getLicitaciones() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("licitaciones").select("*");
    if (error) throw error;
    return { connected: true, licitaciones: (data ?? []) as Licitacion[] };
  } catch {
    return { connected: false, licitaciones: [] as Licitacion[] };
  }
}

function enlace(params: { q?: string; estado?: string; entidad?: string }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.estado) sp.set("estado", params.estado);
  if (params.entidad) sp.set("entidad", params.entidad);
  const s = sp.toString();
  return `/licitaciones${s ? `?${s}` : ""}`;
}

export default async function LicitacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; entidad?: string }>;
}) {
  const { q = "", estado = "", entidad = "" } = await searchParams;
  const { connected, licitaciones } = await getLicitaciones();

  const entidades = [...new Set(licitaciones.map((l) => l.entidad))].sort((a, b) => a.localeCompare(b));
  const texto = q.trim().toLowerCase();
  const filtradas = licitaciones
    .filter((l) => !estado || l.estado === estado)
    .filter((l) => !entidad || l.entidad === entidad)
    .filter((l) => !texto || `${l.entidad} ${l.objeto} ${l.numero_proceso ?? ""}`.toLowerCase().includes(texto))
    .sort((a, b) => {
      const fa = a.fecha_cierre ?? a.fecha_vencimiento;
      const fb = b.fecha_cierre ?? b.fecha_vencimiento;
      if (fa && fb) return fa.localeCompare(fb);
      if (fa) return -1;
      if (fb) return 1;
      return a.entidad.localeCompare(b.entidad);
    });

  const resumenes = await cargarResumenes(filtradas);
  const conteoEstado = (e: EstadoLicitacion) => licitaciones.filter((l) => l.estado === e).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Licitaciones</h1>
          <p className="text-sm text-slate-500">
            {licitaciones.length} procesos. Ordenados por fecha de cierre, con lo que falta para presentar cada oferta.
          </p>
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
          Supabase no está conectado. Configura <code className="rounded bg-amber-100 px-1 py-0.5">.env.local</code>{" "}
          para ver y crear licitaciones.
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form method="get" className="flex flex-wrap items-center gap-3">
          {estado && <input type="hidden" name="estado" value={estado} />}
          <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus-within:border-blue-500">
            <Search size={16} className="text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por entidad, objeto o número de proceso"
              className="w-full bg-transparent outline-none placeholder:text-slate-400"
            />
          </label>
          <select
            name="entidad"
            defaultValue={entidad}
            className="max-w-[260px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Todas las entidades</option>
            {entidades.map((e) => (
              <option key={e} value={e}>
                {e.length > 48 ? `${e.slice(0, 48)}…` : e}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Filtrar
          </button>
          {(q || estado || entidad) && (
            <Link href="/licitaciones" className="text-sm text-blue-600 hover:underline">
              Limpiar
            </Link>
          )}
        </form>
        <div className="flex flex-wrap gap-2">
          <Link
            href={enlace({ q, entidad })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${!estado ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Todas · {licitaciones.length}
          </Link>
          {ESTADOS.filter((e) => conteoEstado(e) > 0 || e === estado).map((e) => (
            <Link
              key={e}
              href={enlace({ q, entidad, estado: e })}
              className={`rounded-full px-3 py-1 text-xs font-medium ${estado === e ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {ESTADO_LABELS[e]} · {conteoEstado(e)}
            </Link>
          ))}
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {licitaciones.length === 0 ? "No hay licitaciones registradas todavía." : "Ninguna licitación coincide con los filtros."}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtradas.map((lic) => {
            const r = resumenes.get(lic.id);
            const fecha = lic.fecha_cierre ?? lic.fecha_vencimiento;
            const dias = diasHasta(fecha);
            const porcentaje = r?.porcentaje ?? 0;
            const colorBarra = porcentaje >= 80 ? "bg-emerald-500" : porcentaje >= 40 ? "bg-blue-500" : "bg-amber-500";
            return (
              <li key={lic.id}>
                <Link
                  href={`/licitaciones/${lic.id}`}
                  className="group grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)]"
                >
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <EstadoBadge estado={lic.estado} />
                      <span className="truncate text-xs font-medium text-blue-700">{lic.entidad}</span>
                      {lic.numero_proceso && <span className="text-xs text-slate-400">· {lic.numero_proceso}</span>}
                    </div>
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-900" title={lic.objeto}>
                      {lic.objeto}
                    </p>
                    {r && r.participantes.length > 0 && (
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {r.participantes.map((p) => `${p.nombre} ${p.porcentaje}%`).join(" · ")}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col justify-center gap-1 text-sm">
                    <span className="font-semibold text-slate-900">{formatCOP(lic.presupuesto)}</span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <CalendarClock size={13} />
                      {fecha ? formatDate(fecha) : "Sin fecha de cierre"}
                      {dias != null && (
                        <span className={dias < 0 ? "text-red-600" : dias <= 7 ? "font-medium text-amber-600" : "text-slate-400"}>
                          · {dias < 0 ? "cerró" : dias === 0 ? "hoy" : `${dias} d`}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col justify-center gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">Preparación {porcentaje}%</span>
                      {r && r.tareasVencidas > 0 && ['en_estudio', 'en_elaboracion', 'presentada'].includes(lic.estado) && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">{r.tareasVencidas} vencida{r.tareasVencidas === 1 ? "" : "s"}</span>
                      )}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${colorBarra}`} style={{ width: `${porcentaje}%` }} />
                    </div>
                    <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                      {r?.siguiente ? (
                        <>
                          <span className="truncate">Siguiente: {r.siguiente.titulo}</span>
                          <ArrowRight size={12} className="shrink-0 text-blue-500 transition-transform group-hover:translate-x-0.5" />
                        </>
                      ) : (
                        "Ruta completa"
                      )}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
