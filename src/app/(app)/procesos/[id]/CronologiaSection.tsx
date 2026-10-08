"use client";

import { useRef } from "react";
import { History, Plus, Trash2 } from "lucide-react";
import { crearCasoHecho, eliminarCasoHecho } from "../actions";
import type { CasoHecho } from "@/lib/casos";
import { formatDate } from "@/lib/format";
import { useAccion } from "./useAccion";
import { ErrorBox } from "./FichaSection";

const inputClass =
  "w-full min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

export function CronologiaSection({ casoId, hechos }: { casoId: string; hechos: CasoHecho[] }) {
  const { isPending, error, run } = useAccion();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 flex items-center gap-2 font-medium text-slate-900">
        <History size={18} className="text-blue-600" />
        Cronología de hechos
      </h2>

      <form
        ref={formRef}
        action={(fd) => run(() => crearCasoHecho(casoId, fd), () => formRef.current?.reset())}
        className="mb-5 grid gap-3 rounded-lg border border-dashed border-slate-300 p-4 md:grid-cols-2 lg:grid-cols-[9rem_9rem_2fr_1fr_auto] lg:items-end"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Fecha</label>
          <input name="fecha" type="date" className={inputClass} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">o fecha aproximada</label>
          <input name="fecha_texto" placeholder="Ej. Por confirmar" className={inputClass} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Hecho</label>
          <input name="hecho" required className={inputClass} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Relevancia</label>
          <input name="relevancia" className={inputClass} />
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

      {hechos.length === 0 ? (
        <p className="text-sm text-slate-400">No hay hechos registrados.</p>
      ) : (
        <ol className="relative ml-2 border-l border-slate-200">
          {hechos.map((h) => (
            <li key={h.id} className="group relative mb-4 ml-5 last:mb-0">
              <span
                className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ${h.fecha ? "bg-blue-600" : "border-2 border-amber-400 bg-white"}`}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-xs font-medium ${h.fecha ? "text-slate-500" : "text-amber-600"}`}>
                    {h.fecha ? formatDate(h.fecha) : h.fecha_texto ?? "Sin fecha"}
                    {h.fecha && h.fecha_texto ? ` · ${h.fecha_texto}` : ""}
                  </p>
                  <p className="text-sm text-slate-800">{h.hecho}</p>
                  {h.relevancia && <p className="text-xs text-slate-500">{h.relevancia}</p>}
                </div>
                <button
                  onClick={() => confirm("¿Eliminar este hecho?") && run(() => eliminarCasoHecho(casoId, h.id))}
                  disabled={isPending}
                  aria-label="Eliminar hecho"
                  className="rounded p-1 text-slate-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
