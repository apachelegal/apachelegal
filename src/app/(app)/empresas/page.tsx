import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Empresa } from "@/lib/types";

async function getEmpresas() {
  const supabase = createAdminClient();

  const { data: empresas, error } = await supabase
    .from("empresas")
    .select("*")
    .order("nombre");

  if (error || !empresas) return [];

  const { data: experiencia } = await supabase.from("experiencia").select("empresa_id");
  const { data: indicadores } = await supabase
    .from("indicadores_financieros")
    .select("empresa_id, periodo")
    .order("periodo", { ascending: false });

  const conteoExperiencia = new Map<string, number>();
  for (const e of experiencia ?? []) {
    conteoExperiencia.set(e.empresa_id, (conteoExperiencia.get(e.empresa_id) ?? 0) + 1);
  }

  const ultimoPeriodo = new Map<string, string>();
  for (const i of indicadores ?? []) {
    if (!ultimoPeriodo.has(i.empresa_id)) ultimoPeriodo.set(i.empresa_id, i.periodo);
  }

  return (empresas as Empresa[]).map((e) => ({
    ...e,
    experienciaCount: conteoExperiencia.get(e.id) ?? 0,
    ultimoPeriodo: ultimoPeriodo.get(e.id) ?? null,
  }));
}

export default async function EmpresasPage() {
  const empresas = await getEmpresas();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Empresas</h1>
          <p className="text-slate-500">
            Perfiles de empresa para verificar cumplimiento de requisitos en licitaciones.
          </p>
        </div>
        <Link
          href="/empresas/nueva"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Nueva empresa
        </Link>
      </div>

      {empresas.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          No hay empresas registradas todavía.
        </div>
      ) : (
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
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{e.experienciaCount} contratos de experiencia</span>
                <span>
                  {e.ultimoPeriodo
                    ? `Indicadores ${e.ultimoPeriodo}`
                    : "Sin indicadores financieros"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
