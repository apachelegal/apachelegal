"use client";

import { useRef } from "react";
import { Plus, Scale, Trash2 } from "lucide-react";
import { actualizarEstadoPrueba, crearCasoPrueba, eliminarCasoPrueba } from "../actions";
import { ESTADO_PRUEBA_LABELS, type CasoPrueba, type EstadoPrueba } from "@/lib/casos";
import { useAccion } from "./useAccion";
import { ErrorBox } from "./FichaSection";

const inputClass =
  "w-full min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

const ESTADO_STYLES: Record<EstadoPrueba, string> = {
  disponible: "border-emerald-200 bg-emerald-50 text-emerald-700",
  parcial: "border-amber-200 bg-amber-50 text-amber-700",
  por_obtener: "border-red-200 bg-red-50 text-red-700",
  por_confirmar: "border-slate-200 bg-slate-50 text-slate-600",
};

export function PruebasSection({ casoId, pruebas }: { casoId: string; pruebas: CasoPrueba[] }) {
  const { isPending, error, run } = useAccion();
  const formRef = useRef<HTMLFormElement>(null);

  const disponibles = pruebas.filter((p) => p.estado === "disponible").length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <Scale size={18} className="text-blue-600" />
          Matriz probatoria
        </h2>
        {pruebas.length > 0 && (
          <span className="text-xs text-slate-500">
            {disponibles} de {pruebas.length} pruebas disponibles
          </span>
        )}
      </div>

      <form
        ref={formRef}
        action={(fd) => run(() => crearCasoPrueba(casoId, fd), () => formRef.current?.reset())}
        className="mb-5 grid gap-3 rounded-lg border border-dashed border-slate-300 p-4 md:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_9rem_auto] lg:items-end"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Hecho a probar</label>
          <input name="hecho" required className={inputClass} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Prueba</label>
          <input name="prueba" className={inputClass} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Fuente</label>
          <input name="fuente" className={inputClass} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Estado</label>
          <select name="estado" defaultValue="por_obtener" className={inputClass}>
            {Object.entries(ESTADO_PRUEBA_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
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

      {pruebas.length === 0 ? (
        <p className="text-sm text-slate-400">No hay pruebas registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2 font-medium">Hecho a probar</th>
                <th className="px-2 py-2 font-medium">Prueba</th>
                <th className="px-2 py-2 font-medium">Fuente</th>
                <th className="w-36 px-2 py-2 font-medium">Estado</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pruebas.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="px-2 py-2 text-slate-800">{p.hecho}</td>
                  <td className="px-2 py-2 text-slate-600">{p.prueba ?? "—"}</td>
                  <td className="px-2 py-2 text-slate-500">{p.fuente ?? "—"}</td>
                  <td className="px-2 py-2">
                    <select
                      value={p.estado}
                      disabled={isPending}
                      onChange={(e) => run(() => actualizarEstadoPrueba(casoId, p.id, e.target.value))}
                      aria-label="Estado de la prueba"
                      className={`w-full rounded-lg border px-2 py-1 text-xs font-medium focus:outline-none disabled:opacity-50 ${ESTADO_STYLES[p.estado]}`}
                    >
                      {Object.entries(ESTADO_PRUEBA_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => confirm("¿Eliminar esta prueba?") && run(() => eliminarCasoPrueba(casoId, p.id))}
                      disabled={isPending}
                      aria-label="Eliminar prueba"
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
