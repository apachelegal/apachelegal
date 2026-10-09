import Link from "next/link";
import { Building2 } from "lucide-react";
import type { Empresa } from "@/lib/types";

type EmpresaConResumen = Empresa & {
  experienciaCount: number;
  ultimoPeriodo: string | null;
};

export function EmpresasGrid({ empresas, emptyLabel }: { empresas: EmpresaConResumen[]; emptyLabel: string }) {
  if (empresas.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {empresas.map((e) => (
        <Link
          key={e.id}
          href={`/empresas/${e.id}`}
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm"
        >
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Building2 size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{e.nombre}</p>
              {e.nit && <p className="text-xs text-slate-400">NIT {e.nit}</p>}
            </div>
          </div>
          {(e.participa_licitaciones || e.ejecuta_obra) && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {e.participa_licitaciones && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">Licitante</span>
              )}
              {e.ejecuta_obra && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Ejecutora de obra</span>
              )}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{e.experienciaCount} contratos de experiencia</span>
            <span>{e.ultimoPeriodo ? `Indicadores ${e.ultimoPeriodo}` : "Sin indicadores financieros"}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
