import Link from "next/link";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { EstadoBadge } from "@/components/EstadoBadge";
import { formatCOP, formatDate, daysUntil } from "@/lib/format";
import type { Licitacion } from "@/lib/types";

async function getLicitaciones() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("licitaciones")
      .select("*")
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return { connected: true, licitaciones: (data ?? []) as Licitacion[] };
  } catch {
    return { connected: false, licitaciones: [] as Licitacion[] };
  }
}

export default async function LicitacionesPage() {
  const { connected, licitaciones } = await getLicitaciones();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Licitaciones</h1>
          <p className="text-slate-500">Procesos de licitación en curso y su documentación.</p>
        </div>
        <Link
          href="/licitaciones/nueva"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Nueva licitación
        </Link>
      </div>

      {!connected && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Supabase no está conectado. Configura <code className="rounded bg-amber-100 px-1 py-0.5">.env.local</code>{" "}
          para ver y crear licitaciones.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {licitaciones.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No hay licitaciones registradas todavía.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Entidad</th>
                <th className="px-4 py-3 font-medium">Objeto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Presupuesto</th>
                <th className="px-4 py-3 font-medium">Vencimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {licitaciones.map((lic) => {
                const dias = daysUntil(lic.fecha_vencimiento);
                return (
                  <tr key={lic.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/licitaciones/${lic.id}`} className="font-medium text-slate-800 hover:text-blue-600">
                        {lic.entidad}
                      </Link>
                      {lic.numero_proceso && (
                        <p className="text-xs text-slate-400">{lic.numero_proceso}</p>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-600">{lic.objeto}</td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={lic.estado} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatCOP(lic.presupuesto)}</td>
                    <td className="px-4 py-3">
                      <span className="text-slate-700">{formatDate(lic.fecha_vencimiento)}</span>
                      {dias != null && (
                        <span className={`ml-2 text-xs ${dias <= 3 ? "text-red-600" : "text-slate-400"}`}>
                          ({dias >= 0 ? `${dias}d` : "vencida"})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
