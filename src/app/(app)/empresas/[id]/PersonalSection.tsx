"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2, Users } from "lucide-react";
import { crearEmpleado, eliminarEmpleado } from "../actions";
import { TIPO_CONTRATO_LABELS, type Empleado } from "@/lib/types";
import { formatCOP, formatDate } from "@/lib/format";

export function PersonalSection({ empresaId, empleados }: { empresaId: string; empleados: Empleado[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleCrear(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await crearEmpleado(empresaId, formData);
        formRef.current?.reset();
        setMostrarFormulario(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al crear el registro");
      }
    });
  }

  function handleEliminar(emp: Empleado) {
    if (!confirm(`¿Eliminar a ${emp.nombre} de la planta de personal?`)) return;
    startTransition(() => eliminarEmpleado(empresaId, emp.id));
  }

  const activos = empleados.filter((e) => !e.fecha_salida).length;
  const ordenados = [...empleados].sort((a, b) =>
    (b.fecha_ingreso ?? "").localeCompare(a.fecha_ingreso ?? ""),
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <Users size={18} className="text-blue-600" />
          Personal ({activos} activos de {empleados.length})
        </h2>
        <button
          onClick={() => setMostrarFormulario((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
        >
          <Plus size={14} />
          Añadir empleado
          {mostrarFormulario ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {mostrarFormulario && (
        <form
          ref={formRef}
          action={handleCrear}
          className="mb-5 flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Nombre" name="nombre" required />
            <Field label="Cargo" name="cargo" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Tipo de contrato</label>
              <select
                name="tipo_contrato"
                defaultValue="termino_fijo"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                {Object.entries(TIPO_CONTRATO_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Salario (COP)" name="salario" type="number" />
            <Field label="Fecha de ingreso" name="fecha_ingreso" type="date" />
            <Field label="Fecha de salida" name="fecha_salida" type="date" />
          </div>
          <Field label="Notas" name="notas" as="textarea" />
          <button
            type="submit"
            disabled={isPending}
            className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Guardar empleado
          </button>
        </form>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {ordenados.length === 0 ? (
        <p className="text-sm text-slate-400">No hay personal registrado todavía.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {ordenados.map((emp) => (
            <li key={emp.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-800">{emp.nombre}</p>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                    {TIPO_CONTRATO_LABELS[emp.tipo_contrato]}
                  </span>
                  {emp.fecha_salida && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      Inactivo
                    </span>
                  )}
                </div>
                {emp.cargo && <p className="mt-0.5 text-sm text-slate-600">{emp.cargo}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {formatDate(emp.fecha_ingreso)} – {emp.fecha_salida ? formatDate(emp.fecha_salida) : "actualidad"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <p className="text-right text-sm font-medium text-slate-800">{formatCOP(emp.salario)}</p>
                <button
                  onClick={() => handleEliminar(emp)}
                  disabled={isPending}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  as,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  as?: "textarea";
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {as === "textarea" ? (
        <textarea
          name={name}
          required={required}
          rows={2}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      )}
    </div>
  );
}
