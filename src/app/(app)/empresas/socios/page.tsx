import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { getEmpresasConResumen } from "@/lib/getEmpresasConResumen";
import { EmpresasGrid } from "@/components/empresas/EmpresasGrid";

export default async function SociosPotencialesPage() {
  const empresas = (await getEmpresasConResumen()).filter((e) => e.categoria === "socio_potencial" && !e.archivada);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/empresas" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} />
        Volver a empresas del grupo
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Posibles socios para consorcios</h1>
          <p className="text-slate-500">
            Empresas externas al grupo que se están evaluando como socias. Verifica primero si el
            grupo puede cumplir solo con sus propias empresas; si no, busca aquí un complemento de
            experiencia o capacidad financiera.
          </p>
        </div>
        <Link
          href="/empresas/nueva?categoria=socio_potencial"
          className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Nuevo posible socio
        </Link>
      </div>

      <EmpresasGrid empresas={empresas} emptyLabel="No hay posibles socios registrados todavía." />
    </div>
  );
}
