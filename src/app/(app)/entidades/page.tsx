import Link from "next/link";
import { Plus, Landmark } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EntidadContratante } from "@/lib/types";

async function getEntidades() {
  const supabase = createAdminClient();

  const { data: entidades, error } = await supabase
    .from("entidades_contratantes")
    .select("*")
    .order("nombre");

  if (error || !entidades) return [];

  const { data: manuales } = await supabase.from("manuales_contratacion").select("entidad_id");

  const conteo = new Map<string, number>();
  for (const m of manuales ?? []) {
    conteo.set(m.entidad_id, (conteo.get(m.entidad_id) ?? 0) + 1);
  }

  return (entidades as EntidadContratante[]).map((e) => ({
    ...e,
    manualesCount: conteo.get(e.id) ?? 0,
  }));
}

export default async function EntidadesPage() {
  const entidades = await getEntidades();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Entidades contratantes</h1>
          <p className="text-slate-500">
            Manuales de contratación por entidad — se usan automáticamente al analizar sus
            licitaciones.
          </p>
        </div>
        <Link
          href="/entidades/nueva"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Nueva entidad
        </Link>
      </div>

      {entidades.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          No hay entidades registradas todavía.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entidades.map((e) => (
            <Link
              key={e.id}
              href={`/entidades/${e.id}`}
              className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Landmark size={18} />
                </div>
                <p className="min-w-0 truncate font-medium text-slate-900">{e.nombre}</p>
              </div>
              <p className="text-xs text-slate-500">
                {e.manualesCount} {e.manualesCount === 1 ? "manual" : "manuales"} de contratación
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
