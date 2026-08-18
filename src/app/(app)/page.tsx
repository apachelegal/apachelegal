import Link from "next/link";
import { Briefcase, Gavel, FileText, Bell } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { EstadoBadge } from "@/components/EstadoBadge";
import { formatDate, daysUntil } from "@/lib/format";
import type { Licitacion } from "@/lib/types";

async function getDashboardData() {
  try {
    const supabase = createAdminClient();

    const enTresDias = new Date();
    enTresDias.setDate(enTresDias.getDate() + 3);
    const limiteAlerta = enTresDias.toISOString().slice(0, 10);

    const [licitacionesRes, proximasRes, documentosRes, alertasRes] = await Promise.all([
      supabase.from("licitaciones").select("*", { count: "exact", head: true }),
      supabase
        .from("licitaciones")
        .select("*")
        .not("fecha_vencimiento", "is", null)
        .order("fecha_vencimiento", { ascending: true })
        .limit(5),
      supabase.from("documentos").select("*", { count: "exact", head: true }),
      supabase
        .from("tareas")
        .select("*", { count: "exact", head: true })
        .neq("estado", "completada")
        .not("fecha_limite", "is", null)
        .lte("fecha_limite", limiteAlerta),
    ]);

    if (licitacionesRes.error || proximasRes.error || documentosRes.error || alertasRes.error) {
      throw licitacionesRes.error ?? proximasRes.error ?? documentosRes.error ?? alertasRes.error;
    }

    const licitacionesCount = licitacionesRes.count;
    const documentosCount = documentosRes.count;
    const alertasCount = alertasRes.count;
    const proximas = proximasRes.data;

    return {
      connected: true,
      licitacionesCount: licitacionesCount ?? 0,
      documentosCount: documentosCount ?? 0,
      alertasCount: alertasCount ?? 0,
      proximas: (proximas ?? []) as Licitacion[],
    };
  } catch {
    return {
      connected: false,
      licitacionesCount: 0,
      documentosCount: 0,
      alertasCount: 0,
      proximas: [] as Licitacion[],
    };
  }
}

export default async function Home() {
  const { connected, licitacionesCount, documentosCount, alertasCount, proximas } =
    await getDashboardData();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Bienvenido</h1>
        <p className="text-slate-500">Gestión Jurídica Inteligente</p>
      </div>

      {!connected && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Supabase no está conectado todavía. Configura{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5">.env.local</code> con tus credenciales
          (ver <code className="rounded bg-amber-100 px-1 py-0.5">.env.local.example</code>) y
          ejecuta <code className="rounded bg-amber-100 px-1 py-0.5">supabase/schema.sql</code> en tu
          proyecto.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Briefcase} label="Procesos" value="—" />
        <StatCard icon={Gavel} label="Licitaciones" value={licitacionesCount} />
        <StatCard icon={FileText} label="Documentos" value={documentosCount} />
        <StatCard icon={Bell} label="Alertas" value={alertasCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-medium text-slate-900">Próximos vencimientos</h2>
          {proximas.length === 0 ? (
            <p className="text-sm text-slate-400">Sin vencimientos próximos.</p>
          ) : (
            <ul className="space-y-3">
              {proximas.map((lic) => {
                const dias = daysUntil(lic.fecha_vencimiento);
                return (
                  <li key={lic.id}>
                    <Link
                      href={`/licitaciones/${lic.id}`}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">{lic.entidad}</p>
                        <p className="text-xs text-slate-500">{lic.objeto}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-700">
                          {formatDate(lic.fecha_vencimiento)}
                        </p>
                        {dias != null && (
                          <p
                            className={`text-xs ${dias <= 3 ? "text-red-600" : "text-slate-400"}`}
                          >
                            {dias >= 0 ? `${dias} días` : "vencida"}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-medium text-slate-900">Licitaciones por estado</h2>
          {licitacionesCount === 0 ? (
            <p className="text-sm text-slate-400">
              Aún no hay licitaciones registradas.{" "}
              <Link href="/licitaciones" className="text-blue-600 hover:underline">
                Crear la primera
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {proximas.map((lic) => (
                <EstadoBadge key={lic.id} estado={lic.estado} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Briefcase;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <Icon size={18} className="text-blue-600" />
      </div>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
