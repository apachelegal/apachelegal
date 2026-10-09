import Link from "next/link";
import { Archive, Plus, Users } from "lucide-react";
import { getEmpresasConResumen } from "@/lib/getEmpresasConResumen";
import { EmpresasGrid } from "@/components/empresas/EmpresasGrid";

type RolFiltro = "todas" | "licitantes" | "ejecutoras";

const FILTROS: { valor: RolFiltro; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "licitantes", label: "Licitantes" },
  { valor: "ejecutoras", label: "Ejecutoras de obra" },
];

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ rol?: string }>;
}) {
  const { rol } = await searchParams;
  const filtro: RolFiltro = rol === "licitantes" || rol === "ejecutoras" ? rol : "todas";

  const todas = await getEmpresasConResumen();
  const delGrupo = todas.filter((e) => e.categoria === "grupo" && !e.archivada);
  const empresas = delGrupo.filter((e) => {
    if (filtro === "licitantes") return e.participa_licitaciones;
    if (filtro === "ejecutoras") return e.ejecuta_obra;
    return true;
  });
  const archivadas = todas.filter((e) => e.archivada).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Empresas del grupo</h1>
          <p className="text-slate-500">
            Perfiles de empresa propias para verificar cumplimiento de requisitos en licitaciones.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {archivadas > 0 && (
            <Link
              href="/empresas/archivadas"
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Archive size={16} />
              Archivadas ({archivadas})
            </Link>
          )}
          <Link
            href="/empresas/socios"
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Users size={16} />
            Posibles socios
          </Link>
          <Link
            href="/empresas/nueva"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Nueva empresa
          </Link>
        </div>
      </div>

      <div className="flex gap-2">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={f.valor === "todas" ? "/empresas" : `/empresas?rol=${f.valor}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filtro === f.valor
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <EmpresasGrid empresas={empresas} emptyLabel="No hay empresas del grupo registradas todavía." />
    </div>
  );
}
