"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarClock, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  actualizarEstadoTarea,
  crearTarea,
  eliminarTarea,
  generarTareasDesdeFechasClave,
} from "./tareas-actions";
import { ESTADO_TAREA_LABELS, type EstadoTarea, type Tarea } from "@/lib/types";
import { formatDate, daysUntil } from "@/lib/format";

export function CronogramaSection({
  licitacionId,
  tareas,
  hayFechasClave,
}: {
  licitacionId: string;
  tareas: Tarea[];
  hayFechasClave: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleCrear(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await crearTarea(licitacionId, formData);
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al crear la tarea");
      }
    });
  }

  function handleEstado(tarea: Tarea, estado: EstadoTarea) {
    setError(null);
    startTransition(async () => {
      try {
        await actualizarEstadoTarea(licitacionId, tarea.id, estado);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al actualizar la tarea");
      }
    });
  }

  function handleEliminar(tarea: Tarea) {
    setError(null);
    startTransition(async () => {
      try {
        await eliminarTarea(licitacionId, tarea.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al eliminar la tarea");
      }
    });
  }

  function handleGenerar() {
    setError(null);
    startTransition(async () => {
      try {
        await generarTareasDesdeFechasClave(licitacionId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al generar tareas");
      }
    });
  }

  const ordenadas = [...tareas].sort((a, b) => {
    if (!a.fecha_limite) return 1;
    if (!b.fecha_limite) return -1;
    return a.fecha_limite.localeCompare(b.fecha_limite);
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <CalendarClock size={18} className="text-blue-600" />
          Cronograma y tareas
        </h2>
        {hayFechasClave && (
          <button
            onClick={handleGenerar}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            <Sparkles size={14} />
            Generar desde fechas clave
          </button>
        )}
      </div>

      <form
        ref={formRef}
        action={handleCrear}
        className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 p-4"
      >
        <div className="flex min-w-[180px] flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Tarea</label>
          <input
            name="titulo"
            required
            placeholder="Ej. Radicar garantía de seriedad"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Responsable</label>
          <input
            name="responsable"
            placeholder="Nombre"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Fecha límite</label>
          <input
            name="fecha_limite"
            type="date"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={16} />
          Añadir
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {ordenadas.length === 0 ? (
        <p className="text-sm text-slate-400">
          No hay tareas todavía. Añade una manualmente
          {hayFechasClave && " o genera el cronograma a partir de las fechas clave detectadas por la IA"}.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {ordenadas.map((tarea) => {
            const dias = daysUntil(tarea.fecha_limite);
            const vencida = dias != null && dias < 0 && tarea.estado !== "completada";
            return (
              <li key={tarea.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={tarea.estado === "completada"}
                    onChange={(e) =>
                      handleEstado(tarea, e.target.checked ? "completada" : "pendiente")
                    }
                    disabled={isPending}
                    className="h-4 w-4 shrink-0 accent-blue-600"
                  />
                  <div className="min-w-0">
                    <p
                      className={`truncate text-sm font-medium ${
                        tarea.estado === "completada"
                          ? "text-slate-400 line-through"
                          : "text-slate-800"
                      }`}
                    >
                      {tarea.titulo}
                    </p>
                    <p className="text-xs text-slate-400">
                      {tarea.responsable ?? "Sin responsable"}
                      {tarea.origen === "ia" && " · generada por IA"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <select
                    value={tarea.estado}
                    onChange={(e) => handleEstado(tarea, e.target.value as EstadoTarea)}
                    disabled={isPending}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  >
                    {Object.entries(ESTADO_TAREA_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <div className="text-right">
                    <p className={`text-sm ${vencida ? "text-red-600" : "text-slate-600"}`}>
                      {formatDate(tarea.fecha_limite)}
                    </p>
                    {dias != null && tarea.estado !== "completada" && (
                      <p className={`text-xs ${vencida ? "text-red-500" : "text-slate-400"}`}>
                        {dias >= 0 ? `${dias}d` : "vencida"}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleEliminar(tarea)}
                    disabled={isPending}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label="Eliminar tarea"
                  >
                    {isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
