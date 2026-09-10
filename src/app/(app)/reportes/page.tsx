import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, Briefcase, Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { EstadoBadge } from "@/components/EstadoBadge";
import { formatCOP } from "@/lib/format";
import {
  ESTADO_LABELS,
  TIPO_CONTRATO_LABELS,
  type AsignacionPersonal,
  type Empleado,
  type Empresa,
  type EstadoLicitacion,
  type IndicadorFinanciero,
  type Licitacion,
  type TipoContrato,
} from "@/lib/types";

const ESTADOS_ACTIVOS: EstadoLicitacion[] = ["en_estudio", "en_elaboracion", "presentada"];

type Alerta = { texto: string; nivel: "critico" | "advertencia" | "neutral" };

async function getDatos() {
  const supabase = createAdminClient();

  const [
    { data: empresas },
    { data: indicadores },
    { data: licitaciones },
    { data: participantes },
    { data: empleados },
    { data: asignaciones },
  ] = await Promise.all([
    supabase.from("empresas").select("*").order("nombre"),
    supabase.from("indicadores_financieros").select("*"),
    supabase.from("licitaciones").select("*"),
    supabase.from("licitacion_participantes").select("empresa_id, licitacion_id"),
    supabase.from("empleados").select("*"),
    supabase.from("asignaciones_personal").select("*"),
  ]);

  return {
    empresas: (empresas ?? []) as Empresa[],
    indicadores: (indicadores ?? []) as IndicadorFinanciero[],
    licitaciones: (licitaciones ?? []) as Licitacion[],
    participantes: (participantes ?? []) as { empresa_id: string; licitacion_id: string }[],
    empleados: (empleados ?? []) as Empleado[],
    asignaciones: (asignaciones ?? []) as AsignacionPersonal[],
  };
}

function ultimoIndicadorPorEmpresa(indicadores: IndicadorFinanciero[]) {
  const porEmpresa = new Map<string, IndicadorFinanciero>();
  for (const ind of indicadores) {
    const actual = porEmpresa.get(ind.empresa_id);
    if (!actual || ind.periodo.localeCompare(actual.periodo) > 0) porEmpresa.set(ind.empresa_id, ind);
  }
  return porEmpresa;
}

function alertasFinancieras(ind: IndicadorFinanciero | undefined): Alerta[] {
  if (!ind) return [{ texto: "Sin indicadores cargados", nivel: "critico" }];

  const alertas: Alerta[] = [];
  if (ind.indice_liquidez != null && ind.indice_liquidez < 1) {
    alertas.push({ texto: `Liquidez baja (${ind.indice_liquidez.toFixed(2)})`, nivel: "critico" });
  }
  if (ind.indice_endeudamiento != null && ind.indice_endeudamiento > 70) {
    alertas.push({ texto: `Endeudamiento alto (${ind.indice_endeudamiento.toFixed(0)}%)`, nivel: "advertencia" });
  }
  if (ind.razon_cobertura_intereses != null && ind.razon_cobertura_intereses < 1) {
    alertas.push({ texto: "Cobertura de intereses insuficiente", nivel: "critico" });
  }
  const anioPeriodo = Number.parseInt(ind.periodo, 10);
  const anioActual = new Date().getFullYear();
  if (Number.isFinite(anioPeriodo) && anioActual - anioPeriodo > 1) {
    alertas.push({ texto: `Período desactualizado (${ind.periodo})`, nivel: "advertencia" });
  }
  return alertas;
}

function AlertaBadge({ alerta }: { alerta: Alerta }) {
  const estilos: Record<Alerta["nivel"], string> = {
    critico: "bg-red-50 text-red-700",
    advertencia: "bg-amber-50 text-amber-700",
    neutral: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estilos[alerta.nivel]}`}>{alerta.texto}</span>
  );
}

function StatTile({
  icon,
  label,
  value,
  tono = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tono?: "neutral" | "critico" | "bien";
}) {
  const tonos: Record<string, string> = {
    neutral: "text-slate-900",
    critico: "text-red-600",
    bien: "text-emerald-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-2 flex items-center gap-2 text-slate-400">{icon}</div>
      <p className={`text-2xl font-semibold ${tonos[tono]}`}>{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export default async function ReportesPage() {
  const { empresas, indicadores, licitaciones, participantes, empleados, asignaciones } = await getDatos();

  const ultimoIndicador = ultimoIndicadorPorEmpresa(indicadores);
  const empresasConAlertaCritica = empresas.filter((e) =>
    alertasFinancieras(ultimoIndicador.get(e.id)).some((a) => a.nivel === "critico"),
  ).length;

  const presupuestoActivo = licitaciones
    .filter((l) => ESTADOS_ACTIVOS.includes(l.estado))
    .reduce((sum, l) => sum + (l.presupuesto ?? 0), 0);

  const porEstado = new Map<EstadoLicitacion, { cantidad: number; presupuesto: number }>();
  for (const lic of licitaciones) {
    const actual = porEstado.get(lic.estado) ?? { cantidad: 0, presupuesto: 0 };
    actual.cantidad += 1;
    actual.presupuesto += lic.presupuesto ?? 0;
    porEstado.set(lic.estado, actual);
  }

  const licitacionesPorId = new Map(licitaciones.map((l) => [l.id, l]));
  const conteoParticipacionPorEmpresa = new Map<string, { activas: number; adjudicadas: number }>();
  for (const p of participantes) {
    const lic = licitacionesPorId.get(p.licitacion_id);
    if (!lic) continue;
    const actual = conteoParticipacionPorEmpresa.get(p.empresa_id) ?? { activas: 0, adjudicadas: 0 };
    if (ESTADOS_ACTIVOS.includes(lic.estado)) actual.activas += 1;
    if (lic.estado === "adjudicada") actual.adjudicadas += 1;
    conteoParticipacionPorEmpresa.set(p.empresa_id, actual);
  }
  const empresasConParticipacion = empresas
    .filter((e) => conteoParticipacionPorEmpresa.has(e.id))
    .sort(
      (a, b) =>
        (conteoParticipacionPorEmpresa.get(b.id)?.activas ?? 0) -
        (conteoParticipacionPorEmpresa.get(a.id)?.activas ?? 0),
    );

  const empleadosPorId = new Map(empleados.map((e) => [e.id, e]));
  const dedicacionActivaPorEmpleado = new Map<string, number>();
  for (const a of asignaciones) {
    if (a.fecha_fin || a.dedicacion_pct == null) continue;
    dedicacionActivaPorEmpleado.set(
      a.empleado_id,
      (dedicacionActivaPorEmpleado.get(a.empleado_id) ?? 0) + a.dedicacion_pct,
    );
  }
  const sobreAsignados = [...dedicacionActivaPorEmpleado.entries()]
    .filter(([, pct]) => pct > 100)
    .map(([empleadoId, pct]) => ({ empleado: empleadosPorId.get(empleadoId), pct }))
    .filter((s): s is { empleado: Empleado; pct: number } => s.empleado != null);

  const empleadosActivos = empleados.filter((e) => !e.fecha_salida);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en30Dias = new Date(hoy);
  en30Dias.setDate(en30Dias.getDate() + 30);
  const contratosPorVencer = empleadosActivos.filter((e) => {
    if (!e.fecha_salida) return false;
    const fecha = new Date(e.fecha_salida + "T00:00:00");
    return fecha >= hoy && fecha <= en30Dias;
  });

  const empleadosPorEmpresa = new Map<string, Empleado[]>();
  for (const emp of empleadosActivos) {
    const lista = empleadosPorEmpresa.get(emp.empresa_id) ?? [];
    lista.push(emp);
    empleadosPorEmpresa.set(emp.empresa_id, lista);
  }
  const maxHeadcount = Math.max(1, ...[...empleadosPorEmpresa.values()].map((l) => l.length));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Reportes</h1>
        <p className="text-slate-500">Salud financiera, pipeline de licitaciones y planta de personal del grupo.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<AlertTriangle size={18} />}
          label="Empresas con alerta financiera crítica"
          value={`${empresasConAlertaCritica} / ${empresas.length}`}
          tono={empresasConAlertaCritica > 0 ? "critico" : "bien"}
        />
        <StatTile
          icon={<Banknote size={18} />}
          label="Presupuesto en licitaciones activas"
          value={formatCOP(presupuestoActivo)}
        />
        <StatTile icon={<Users size={18} />} label="Personal activo" value={String(empleadosActivos.length)} />
        <StatTile
          icon={<Briefcase size={18} />}
          label="Contratos por vencer (30 días)"
          value={String(contratosPorVencer.length)}
          tono={contratosPorVencer.length > 0 ? "critico" : "bien"}
        />
        <StatTile
          icon={<AlertTriangle size={18} />}
          label="Personal sobre-asignado (>100% dedicación)"
          value={String(sobreAsignados.length)}
          tono={sobreAsignados.length > 0 ? "critico" : "bien"}
        />
      </div>

      {/* Salud financiera */}
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-slate-900">Salud financiera por empresa</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {empresas.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">No hay empresas registradas todavía.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Período</th>
                  <th className="px-4 py-3 font-medium">Liquidez</th>
                  <th className="px-4 py-3 font-medium">Endeudamiento</th>
                  <th className="px-4 py-3 font-medium">Patrimonio</th>
                  <th className="px-4 py-3 font-medium">Alertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {empresas.map((e) => {
                  const ind = ultimoIndicador.get(e.id);
                  const alertas = alertasFinancieras(ind);
                  return (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/empresas/${e.id}`} className="font-medium text-slate-800 hover:text-blue-600">
                          {e.nombre}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{ind?.periodo ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{ind?.indice_liquidez?.toFixed(2) ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {ind?.indice_endeudamiento != null ? `${ind.indice_endeudamiento.toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatCOP(ind?.patrimonio ?? null)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {alertas.length === 0 ? (
                            <AlertaBadge alerta={{ texto: "Saludable", nivel: "neutral" }} />
                          ) : (
                            alertas.map((a, i) => <AlertaBadge key={i} alerta={a} />)
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Pipeline de licitaciones */}
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-slate-900">Pipeline de licitaciones</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Cantidad</th>
                  <th className="px-4 py-3 font-medium">Presupuesto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(Object.keys(ESTADO_LABELS) as EstadoLicitacion[]).map((estado) => {
                  const datos = porEstado.get(estado);
                  if (!datos) return null;
                  return (
                    <tr key={estado}>
                      <td className="px-4 py-3">
                        <EstadoBadge estado={estado} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{datos.cantidad}</td>
                      <td className="px-4 py-3 text-slate-600">{formatCOP(datos.presupuesto)}</td>
                    </tr>
                  );
                })}
                {licitaciones.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-400">
                      No hay licitaciones registradas todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Activas</th>
                  <th className="px-4 py-3 font-medium">Adjudicadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {empresasConParticipacion.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-400">
                      Ninguna empresa está vinculada a una licitación todavía.
                    </td>
                  </tr>
                ) : (
                  empresasConParticipacion.map((e) => {
                    const c = conteoParticipacionPorEmpresa.get(e.id)!;
                    return (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/empresas/${e.id}`}
                            className="font-medium text-slate-800 hover:text-blue-600"
                          >
                            {e.nombre}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{c.activas}</td>
                        <td className="px-4 py-3 text-slate-600">{c.adjudicadas}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Personal */}
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-slate-900">Personal por empresa</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {empresas.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">No hay empresas registradas todavía.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Activos</th>
                  <th className="px-4 py-3 font-medium">Por tipo de contrato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {empresas.map((e) => {
                  const lista = empleadosPorEmpresa.get(e.id) ?? [];
                  const porTipo = new Map<TipoContrato, number>();
                  for (const emp of lista) porTipo.set(emp.tipo_contrato, (porTipo.get(emp.tipo_contrato) ?? 0) + 1);
                  return (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/empresas/${e.id}`} className="font-medium text-slate-800 hover:text-blue-600">
                          {e.nombre}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 shrink-0 text-slate-600">{lista.length}</span>
                          <span
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${Math.max(4, (lista.length / maxHeadcount) * 96)}px` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {lista.length === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            [...porTipo.entries()].map(([tipo, cantidad]) => (
                              <span
                                key={tipo}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                              >
                                {cantidad} {TIPO_CONTRATO_LABELS[tipo]}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {contratosPorVencer.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-2 text-sm font-medium text-amber-800">
              {contratosPorVencer.length} contrato(s) vencen en los próximos 30 días
            </p>
            <ul className="flex flex-col gap-1 text-sm text-amber-700">
              {contratosPorVencer.map((emp) => (
                <li key={emp.id}>
                  {emp.nombre} — {emp.cargo ?? "sin cargo"} — vence {emp.fecha_salida}
                </li>
              ))}
            </ul>
          </div>
        )}

        {sobreAsignados.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="mb-2 text-sm font-medium text-red-800">
              {sobreAsignados.length} persona(s) con dedicación combinada superior a 100% entre proyectos activos
            </p>
            <ul className="flex flex-col gap-1 text-sm text-red-700">
              {sobreAsignados.map(({ empleado, pct }) => (
                <li key={empleado.id}>
                  <Link href={`/empresas/${empleado.empresa_id}`} className="underline hover:no-underline">
                    {empleado.nombre}
                  </Link>{" "}
                  — {empleado.cargo ?? "sin cargo"} — {pct}% dedicación combinada
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
