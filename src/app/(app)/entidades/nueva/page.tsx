import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { crearEntidad } from "../actions";

export default function NuevaEntidadPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <Link href="/entidades" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} />
        Volver a entidades
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Nueva entidad contratante</h1>
        <p className="text-slate-500">
          Registra la entidad (ej. EAAB, ANI) para asociarle su manual de contratación.
        </p>
      </div>

      <form action={crearEntidad} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-1">
          <label htmlFor="nombre" className="text-sm font-medium text-slate-700">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            placeholder="Ej. Empresa de Acueducto y Alcantarillado de Bogotá (EAAB-ESP)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="notas" className="text-sm font-medium text-slate-700">
            Notas
          </label>
          <textarea
            id="notas"
            name="notas"
            rows={3}
            placeholder="Observaciones adicionales"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Link
            href="/entidades"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Crear entidad
          </button>
        </div>
      </form>
    </div>
  );
}
