import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createLicitacion } from "../actions";
import { ESTADO_LABELS } from "@/lib/types";

export default function NuevaLicitacionPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/licitaciones" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} />
        Volver a licitaciones
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Nueva licitación</h1>
        <p className="text-slate-500">Registra un nuevo proceso de licitación.</p>
      </div>

      <form action={createLicitacion} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <Field label="Entidad" name="entidad" required placeholder="Ej. EAAB" />
        <Field label="Objeto" name="objeto" required as="textarea" placeholder="Objeto del proceso" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Número de proceso" name="numero_proceso" placeholder="Ej. LP-2026-014" />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Estado</label>
            <select
              name="estado"
              defaultValue="en_estudio"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {Object.entries(ESTADO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Presupuesto (COP)" name="presupuesto" type="number" placeholder="0" />
          <Field label="Responsable" name="responsable" placeholder="Nombre del responsable" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Fecha de apertura" name="fecha_apertura" type="date" />
          <Field label="Fecha de cierre" name="fecha_cierre" type="date" />
          <Field label="Fecha de vencimiento" name="fecha_vencimiento" type="date" />
        </div>
        <Field label="Notas" name="notas" as="textarea" placeholder="Observaciones adicionales" />

        <div className="mt-2 flex justify-end gap-3">
          <Link
            href="/licitaciones"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Crear licitación
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  as,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  as?: "textarea";
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {as === "textarea" ? (
        <textarea
          id={name}
          name={name}
          required={required}
          placeholder={placeholder}
          rows={3}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      )}
    </div>
  );
}
