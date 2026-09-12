import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { crearEmpresa } from "../actions";

export default function NuevaEmpresaPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <Link href="/empresas" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} />
        Volver a empresas
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Nueva empresa</h1>
        <p className="text-slate-500">
          Registra una empresa (propia, filial o socia de consorcio) para verificar su
          cumplimiento en licitaciones.
        </p>
      </div>

      <form action={crearEmpresa} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-1">
          <label htmlFor="nombre" className="text-sm font-medium text-slate-700">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            placeholder="Ej. I2C Ingeniería S.A.S"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="nit" className="text-sm font-medium text-slate-700">
            NIT
          </label>
          <input
            id="nit"
            name="nit"
            placeholder="900.000.000-0"
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

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">Rol en el grupo</span>
          <p className="text-xs text-slate-400">
            No son excluyentes: una empresa puede licitar y también ejecutar la obra.
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              name="participa_licitaciones"
              defaultChecked
              className="rounded border-slate-300"
            />
            Participa en licitaciones (proponente / consorciada)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="ejecuta_obra" className="rounded border-slate-300" />
            Ejecuta obra (operativa en el sitio de la obra)
          </label>
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Link
            href="/empresas"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Crear empresa
          </button>
        </div>
      </form>
    </div>
  );
}
