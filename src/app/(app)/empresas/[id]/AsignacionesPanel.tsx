"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { actualizarAsignacion, crearAsignacion, eliminarAsignacion } from "../actions";
import type { AsignacionPersonal } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function AsignacionesPanel({
  empresaId,
  empleadoId,
  asignaciones,
  licitaciones,
}: {
  empresaId: string;
  empleadoId: string;
  asignaciones: AsignacionPersonal[];
  licitaciones: { id: string; entidad: string; objeto: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleCrear(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await crearAsignacion(empresaId, empleadoId, formData);
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al crear la asignación");
      }
    });
  }

  function handleActualizar(asignacionId: string, formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await actualizarAsignacion(empresaId, asignacionId, formData);
        setEditando(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al actualizar la asignación");
      }
    });
  }

  function handleEliminar(a: AsignacionPersonal) {
    if (!confirm(`¿Eliminar la asignación a ${a.proyecto}?`)) return;
    startTransition(() => eliminarAsignacion(empresaId, a.id));
  }

  const dedicacionTotal = asignaciones
    .filter((a) => !a.fecha_fin)
    .reduce((sum, a) => sum + (a.dedicacion_pct ?? 0), 0);

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">
          Asignaciones a proyecto/obra
          {dedicacionTotal > 0 && (
            <span className={`ml-2 ${dedicacionTotal > 100 ? "font-semibold text-red-600" : "text-slate-400"}`}>
              ({dedicacionTotal}% dedicación activa combinada
              {dedicacionTotal > 100 ? " — excede 100%" : ""})
            </span>
          )}
        </p>
      </div>

      {asignaciones.length === 0 ? (
        <p className="mb-2 text-xs text-slate-400">Sin asignaciones registradas.</p>
      ) : (
        <ul className="mb-2 divide-y divide-slate-200">
          {asignaciones.map((a) =>
            editando === a.id ? (
              <li key={a.id} className="py-2">
                <form
                  action={(fd) => handleActualizar(a.id, fd)}
                  className="flex flex-wrap items-end gap-2 rounded border border-dashed border-blue-300 bg-blue-50/50 p-2"
                >
                  <MiniField label="Proyecto/obra" name="proyecto" required className="w-32" defaultValue={a.proyecto} />
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[11px] text-slate-500">Licitación vinculada</label>
                    <select
                      name="licitacion_id"
                      defaultValue={a.licitacion_id ?? ""}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Ninguna</option>
                      {licitaciones.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.entidad} — {l.objeto.slice(0, 30)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <MiniField label="Rol" name="rol" className="w-28" defaultValue={a.rol ?? ""} />
                  <MiniField
                    label="Dedicación %"
                    name="dedicacion_pct"
                    type="number"
                    className="w-20"
                    defaultValue={a.dedicacion_pct ?? ""}
                  />
                  <MiniField
                    label="Contratado por"
                    name="contratado_por"
                    className="w-28"
                    defaultValue={a.contratado_por ?? ""}
                  />
                  <MiniField label="Desde" name="fecha_inicio" type="date" className="w-32" defaultValue={a.fecha_inicio ?? ""} />
                  <MiniField label="Hasta" name="fecha_fin" type="date" className="w-32" defaultValue={a.fecha_fin ?? ""} />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditando(null)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </form>
              </li>
            ) : (
              <li key={a.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                <div className="min-w-0">
                  <span className="font-medium text-slate-700">{a.proyecto}</span>
                  {a.rol && <span className="text-slate-500"> — {a.rol}</span>}
                  {a.dedicacion_pct != null && <span className="text-slate-500"> · {a.dedicacion_pct}%</span>}
                  {a.contratado_por && <span className="text-slate-400"> · {a.contratado_por}</span>}
                  {a.fecha_inicio && <span className="text-slate-400"> · desde {formatDate(a.fecha_inicio)}</span>}
                  {a.fecha_fin && <span className="text-slate-400"> · hasta {formatDate(a.fecha_fin)}</span>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setEditando(a.id)}
                    className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                    aria-label="Editar asignación"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => handleEliminar(a)}
                    disabled={isPending}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label="Eliminar asignación"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      <form ref={formRef} action={handleCrear} className="flex flex-wrap items-end gap-2">
        <MiniField label="Proyecto/obra" name="proyecto" required className="w-32" />
        <div className="flex flex-col gap-0.5">
          <label className="text-[11px] text-slate-500">Licitación vinculada</label>
          <select
            name="licitacion_id"
            defaultValue=""
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
          >
            <option value="">Ninguna</option>
            {licitaciones.map((l) => (
              <option key={l.id} value={l.id}>
                {l.entidad} — {l.objeto.slice(0, 30)}
              </option>
            ))}
          </select>
        </div>
        <MiniField label="Rol" name="rol" className="w-28" />
        <MiniField label="Dedicación %" name="dedicacion_pct" type="number" className="w-20" />
        <MiniField label="Contratado por" name="contratado_por" className="w-28" />
        <MiniField label="Desde" name="fecha_inicio" type="date" className="w-32" />
        <MiniField label="Hasta" name="fecha_fin" type="date" className="w-32" />
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Añadir
        </button>
      </form>
    </div>
  );
}

function MiniField({
  label,
  name,
  type = "text",
  required,
  className,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  className?: string;
  defaultValue?: string | number;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${className ?? ""}`}>
      <label className="text-[11px] text-slate-500">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}
