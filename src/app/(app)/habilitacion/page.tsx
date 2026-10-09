import Link from "next/link";
import { AlertTriangle, CalendarClock, FolderCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Empresa, EmpresaDocumento, Experiencia } from "@/lib/types";
import { evaluarCarpeta, normalizarCierre } from "@/lib/habilitacion/checklist";

function Celda({ valor, detalle }: { valor: number | null; detalle?: string }) {
  const color =
    valor == null ? "text-slate-400" : valor >= 100 ? "text-emerald-600" : valor >= 50 ? "text-amber-600" : "text-red-600";
  return (
    <div>
      <span className={`text-base font-semibold ${color}`}>{valor == null ? "—" : `${valor}%`}</span>
      {detalle && <p className="text-xs text-slate-400">{detalle}</p>}
    </div>
  );
}

export default async function HabilitacionPage({
  searchParams,
}: {
  searchParams: Promise<{ cierre?: string }>;
}) {
  const { cierre: cierreParam } = await searchParams;
  const cierre = normalizarCierre(cierreParam);
  const supabase = createAdminClient();

  const [{ data: empresas }, { data: documentos }, { data: experiencia }, { data: experienciaDocs }] =
    await Promise.all([
      supabase.from("empresas").select("*").order("nombre"),
      supabase.from("empresa_documentos").select("*"),
      supabase.from("experiencia").select("id, empresa_id, entidad_contratante, estado, verificacion_titular"),
      supabase.from("experiencia_documentos").select("experiencia_id"),
    ]);

  const conCertificado = new Set((experienciaDocs ?? []).map((d) => d.experiencia_id as string));

  const filas = ((empresas ?? []) as Empresa[]).filter((emp) => !emp.archivada).map((emp) => {
    const docs = ((documentos ?? []) as EmpresaDocumento[]).filter((d) => d.empresa_id === emp.id);
    const exp = ((experiencia ?? []) as Experiencia[]).filter((e) => e.empresa_id === emp.id);
    return { emp, estado: evaluarCarpeta(emp, docs, exp, conCertificado, cierre) };
  });

  const grupos: { titulo: string; lista: typeof filas }[] = [
    { titulo: "Empresas del grupo", lista: filas.filter((f) => f.emp.categoria === "grupo") },
    { titulo: "Posibles socios", lista: filas.filter((f) => f.emp.categoria === "socio_potencial") },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <FolderCheck size={24} className="text-blue-600" />
            Habilitación
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Qué tan lista está la documentación de cada empresa para presentarse a una licitación. La lista de
            documentos y sus vigencias sale del pliego real de la EAAB (ICSM-1767-2025). Cada proceso puede variar
            los detalles.
          </p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1">
              <CalendarClock size={12} /> Cierre de referencia
            </span>
            <input
              type="date"
              name="cierre"
              defaultValue={cierre}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
            />
          </label>
          <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Aplicar
          </button>
        </form>
      </div>

      {grupos.map(({ titulo, lista }) => (
        <section key={titulo} className="rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800">{titulo}</h2>
          {lista.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">Sin empresas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-2 font-medium">Empresa</th>
                    <th className="px-3 py-2 font-medium">Jurídica</th>
                    <th className="px-3 py-2 font-medium">Financiera</th>
                    <th className="px-3 py-2 font-medium">Técnica</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                    <th className="px-5 py-2 font-medium">Por resolver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lista.map(({ emp, estado }) => (
                    <tr key={emp.id} className="align-top">
                      <td className="px-5 py-3">
                        <Link
                          href={`/empresas/${emp.id}?cierre=${cierre}#carpeta`}
                          className="font-medium text-slate-900 hover:text-blue-600"
                        >
                          {emp.nombre}
                        </Link>
                        <p className="text-xs text-slate-400">
                          {emp.tipo_persona === "natural" ? "Persona natural" : "Persona jurídica"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <Celda valor={estado.porcentajes.juridica} />
                      </td>
                      <td className="px-3 py-3">
                        <Celda valor={estado.porcentajes.financiera} />
                      </td>
                      <td className="px-3 py-3">
                        <Celda
                          valor={estado.porcentajes.tecnica}
                          detalle={`${estado.tecnica.conCertificado}/${estado.tecnica.totalContratos} certificados`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Celda valor={estado.porcentajes.global} />
                      </td>
                      <td className="px-5 py-3">
                        {estado.alertas.length === 0 ? (
                          <span className="text-xs text-emerald-600">Sin pendientes</span>
                        ) : (
                          <details>
                            <summary className="flex cursor-pointer items-center gap-1 text-xs text-amber-700">
                              <AlertTriangle size={13} />
                              {estado.alertas.length} pendiente{estado.alertas.length === 1 ? "" : "s"}
                            </summary>
                            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-600">
                              {estado.alertas.map((a) => (
                                <li key={a}>{a}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
