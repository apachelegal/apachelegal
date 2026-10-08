"use client";

import { useRef } from "react";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { actualizarCasoTarea, crearCasoTarea, eliminarCasoTarea } from "../actions";
import { ESTADO_CASO_TAREA_LABELS, tareaAbierta, type CasoTarea } from "@/lib/casos";
import { daysUntil } from "@/lib/format";
import { useAccion } from "./useAccion";
import { ErrorBox } from "./FichaSection";

const inputClass =
  "w-full min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
const cellInput =
  "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-slate-200 focus:border-blue-500 focus:bg-white focus:outline-none";

export function TareasSection({ casoId, tareas }: { casoId: string; tareas: CasoTarea[] }) {
  const { isPending, error, run } = useAccion();
  const formRef = useRef<HTMLFormElement>(null);

  const abiertas = tareas.filter(tareaAbierta);
  const vencidas = abiertas.filter((t) => (daysUntil(t.fecha_limite) ?? 1) < 0);
  const cumplidas = tareas.filter((t) => t.estado === "completada");

  function cambiar(tarea: CasoTarea, cambios: Parameters<typeof actualizarCasoTarea>[2]) {
    run(() => actualizarCasoTarea(casoId, tarea.id, cambios));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <ListChecks size={18} className="text-blue-600" />
          Plan de acciones
        </h2>
        <div className="flex gap-2 text-xs">
          <Contador label="Abiertas" valor={abiertas.length} clase="bg-slate-100 text-slate-700" />
          <Contador label="Vencidas" valor={vencidas.length} clase={vencidas.length ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"} />
          <Contador label="Cumplidas" valor={cumplidas.length} clase="bg-emerald-100 text-emerald-700" />
        </div>
      </div>

      <form
        ref={formRef}
        action={(fd) => run(() => crearCasoTarea(casoId, fd), () => formRef.current?.reset())}
        className="mb-5 grid gap-3 rounded-lg border border-dashed border-slate-300 p-4 md:grid-cols-2 lg:grid-cols-[1fr_2fr_1fr_9rem_8rem_auto] lg:items-end"
      >
        <Campo label="Ante quién"><input name="ante_quien" placeholder="Ej. Interventoría" className={inputClass} /></Campo>
        <Campo label="Acción"><input name="accion" required placeholder="Qué hay que hacer" className={inputClass} /></Campo>
        <Campo label="Para qué"><input name="proposito" className={inputClass} /></Campo>
        <Campo label="Fecha límite"><input name="fecha_limite" type="date" className={inputClass} /></Campo>
        <Campo label="Responsable"><input name="responsable" className={inputClass} /></Campo>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={16} />
          Añadir
        </button>
      </form>

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      {tareas.length === 0 ? (
        <p className="text-sm text-slate-400">No hay acciones registradas todavía.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-8 px-2 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Ante quién / acción</th>
                <th className="w-36 px-2 py-2 font-medium">Fecha límite</th>
                <th className="w-32 px-2 py-2 font-medium">Responsable</th>
                <th className="w-32 px-2 py-2 font-medium">Estado</th>
                <th className="w-36 px-2 py-2 font-medium">Cumplida el</th>
                <th className="px-2 py-2 font-medium">Soporte</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tareas.map((t, i) => {
                const dias = daysUntil(t.fecha_limite);
                const abierta = tareaAbierta(t);
                const vencida = abierta && dias != null && dias < 0;
                const fila = vencida ? "bg-red-50/60" : t.estado === "completada" ? "bg-emerald-50/50" : "";
                return (
                  <tr key={t.id} className={`align-top ${fila}`}>
                    <td className="px-2 py-2 text-slate-400">{t.orden ?? i + 1}</td>
                    <td className="px-2 py-2">
                      {t.ante_quien && <p className="text-xs font-medium text-slate-500">{t.ante_quien}</p>}
                      <p className={t.estado === "completada" || t.estado === "descartada" ? "text-slate-400 line-through" : "text-slate-800"}>
                        {t.accion}
                      </p>
                      {t.proposito && <p className="text-xs text-slate-400">{t.proposito}</p>}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        defaultValue={t.fecha_limite ?? ""}
                        onBlur={(e) => e.target.value !== (t.fecha_limite ?? "") && cambiar(t, { fecha_limite: e.target.value || null })}
                        className={cellInput}
                        aria-label="Fecha límite"
                      />
                      {abierta && dias != null && (
                        <p className={`px-1.5 text-xs ${vencida ? "font-medium text-red-600" : dias <= 2 ? "text-amber-600" : "text-slate-400"}`}>
                          {vencida ? `vencida hace ${-dias}d` : dias === 0 ? "vence hoy" : `faltan ${dias}d`}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        defaultValue={t.responsable ?? ""}
                        placeholder="Asignar"
                        onBlur={(e) => e.target.value.trim() !== (t.responsable ?? "") && cambiar(t, { responsable: e.target.value })}
                        className={cellInput}
                        aria-label="Responsable"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={t.estado}
                        disabled={isPending}
                        onChange={(e) => cambiar(t, { estado: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:opacity-50"
                        aria-label="Estado"
                      >
                        {Object.entries(ESTADO_CASO_TAREA_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        key={t.fecha_cumplimiento ?? "vacio"}
                        type="date"
                        defaultValue={t.fecha_cumplimiento ?? ""}
                        onBlur={(e) => e.target.value !== (t.fecha_cumplimiento ?? "") && cambiar(t, { fecha_cumplimiento: e.target.value || null })}
                        className={cellInput}
                        aria-label="Fecha de cumplimiento"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <textarea
                        defaultValue={t.soporte ?? ""}
                        placeholder="Radicado, enlace u observación"
                        rows={2}
                        onBlur={(e) => e.target.value.trim() !== (t.soporte ?? "") && cambiar(t, { soporte: e.target.value })}
                        className={`${cellInput} resize-y`}
                        aria-label="Soporte"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => confirm("¿Eliminar esta acción?") && run(() => eliminarCasoTarea(casoId, t.id))}
                        disabled={isPending}
                        aria-label="Eliminar acción"
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Contador({ label, valor, clase }: { label: string; valor: number; clase: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 font-medium ${clase}`}>
      {label}: {valor}
    </span>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}
