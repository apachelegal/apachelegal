import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { crearCaso } from "../actions";
import { CasoCampos } from "../CasoCampos";

export default function NuevoCasoPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/procesos" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} />
        Volver a procesos
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Nuevo caso</h1>
        <p className="text-slate-500">Registra un caso o controversia para hacerle seguimiento.</p>
      </div>

      <form action={crearCaso} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <CasoCampos />
        <div className="mt-2 flex justify-end gap-3">
          <Link
            href="/procesos"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Crear caso
          </button>
        </div>
      </form>
    </div>
  );
}
