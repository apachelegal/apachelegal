import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getEmpresasConResumen } from "@/lib/getEmpresasConResumen";
import { EmpresasGrid } from "@/components/empresas/EmpresasGrid";

export default async function EmpresasArchivadasPage() {
  const empresas = (await getEmpresasConResumen()).filter((e) => e.archivada);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/empresas" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} />
        Volver a empresas del grupo
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Empresas archivadas</h1>
        <p className="text-slate-500">
          No aparecen en las listas, la habilitación ni el recomendador, pero conservan todos sus datos, documentos y
          experiencia. Abre una para restaurarla.
        </p>
      </div>

      <EmpresasGrid empresas={empresas} emptyLabel="No hay empresas archivadas." />
    </div>
  );
}
