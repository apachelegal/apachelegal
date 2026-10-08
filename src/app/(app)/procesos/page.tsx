import Link from "next/link";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, daysUntil } from "@/lib/format";
import { ETAPA_CASO_LABELS, ESTADO_CASO_LABELS, tareaAbierta, type Caso, type CasoTarea } from "@/lib/casos";

type TareaResumen = Pick<CasoTarea, "caso_id" | "estado" | "fecha_limite" | "accion">;

async function getCasos() {
  try {
    const supabase = createAdminClient();
    const [{ data: casos, error }, { data: tareas, error: tareasError }] = await Promise.all([
      supabase.from("casos").select("*").order("created_at", { ascending: false }),
      supabase.from("caso_tareas").select("caso_id, estado, fecha_limite, accion"),
    ]);
    if (error) throw error;
    if (tareasError) throw tareasError;
    return { connected: true, casos: (casos ?? []) as Caso[], tareas: (tareas ?? []) as TareaResumen[] };
  } catch {
    return { connected: false, casos: [] as Caso[], tareas: [] as TareaResumen[] };
  }
}

export default async function ProcesosPage() {
  const { connected, casos, tareas } = await getCasos();

  const porCaso = new Map<string, TareaResumen[]>();
  for (const t of tareas) {
    if (!tareaAbierta(t)) continue;
    const lista = porCaso.get(t.caso_id) ?? [];
    lista.push(t);
    porCaso.set(t.caso_id, lista);
  }

  const activos = casos.filter((c) => c.estado !== "cerrado");
  const cerrados = casos.filter((c) => c.estado === "cerrado");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Procesos</h1>
          <p className="text-slate-500">Casos y controversias contractuales con su plan de acciones.</p>
        </div>
        <Link
          href="/procesos/nuevo"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Nuevo caso
        </Link>
      </div>

      {!connected && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No se pudo leer el módulo de procesos. Verifica la conexión a Supabase y que se haya ejecutado{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5">supabase/procesos.sql</code>.
        </div>
      )}

      <CasosTabla casos={activos} porCaso={porCaso} vacio="No hay casos activos." />

      {cerrados.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Cerrados</h2>
          <CasosTabla casos={cerrados} porCaso={porCaso} vacio="" />
        </div>
      )}
    </div>
  );
}

function CasosTabla({
  casos,
  porCaso,
  vacio,
}: {
  casos: Caso[];
  porCaso: Map<string, TareaResumen[]>;
  vacio: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {casos.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-400">{vacio}</div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Caso</th>
              <th className="px-4 py-3 font-medium">Contraparte</th>
              <th className="px-4 py-3 font-medium">Etapa</th>
              <th className="px-4 py-3 font-medium">Tareas abiertas</th>
              <th className="px-4 py-3 font-medium">Próximo plazo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {casos.map((caso) => {
              const abiertas = porCaso.get(caso.id) ?? [];
              const vencidas = abiertas.filter((t) => (daysUntil(t.fecha_limite) ?? 1) < 0).length;
              const proxima = abiertas
                .filter((t) => t.fecha_limite)
                .sort((a, b) => a.fecha_limite!.localeCompare(b.fecha_limite!))[0];
              const dias = proxima ? daysUntil(proxima.fecha_limite) : null;
              return (
                <tr key={caso.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/procesos/${caso.id}`} className="font-medium text-slate-800 hover:text-blue-600">
                      {caso.titulo}
                    </Link>
                    {caso.cliente && <p className="text-xs text-slate-400">Cliente: {caso.cliente}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{caso.contraparte ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {ETAPA_CASO_LABELS[caso.etapa]}
                    </span>
                    {caso.estado !== "activo" && (
                      <span className="ml-2 text-xs text-slate-400">{ESTADO_CASO_LABELS[caso.estado]}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {abiertas.length}
                    {vencidas > 0 && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        {vencidas} vencida{vencidas > 1 ? "s" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {proxima ? (
                      <>
                        <span className="text-slate-700">{formatDate(proxima.fecha_limite)}</span>
                        {dias != null && (
                          <span className={`ml-2 text-xs ${dias <= 2 ? "text-red-600" : "text-slate-400"}`}>
                            ({dias >= 0 ? `${dias}d` : "vencida"})
                          </span>
                        )}
                        <p className="max-w-xs truncate text-xs text-slate-400">{proxima.accion}</p>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
