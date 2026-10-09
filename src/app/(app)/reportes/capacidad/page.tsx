import Link from "next/link";
import { Download } from "lucide-react";
import { calcularCapacidadGrupo, calcularExperienciaPtarPtap } from "@/lib/scoring/capacidadGrupo";
import { createAdminClient } from "@/lib/supabase/admin";

const INFORME_SOCIOS_PATH = "grupo/Capacidad_grupo_socios.docx";

async function getInformeSociosUrl() {
  const supabase = createAdminClient();
  const { data } = await supabase.storage
    .from("reportes")
    .createSignedUrl(INFORME_SOCIOS_PATH, 60 * 60);
  return data?.signedUrl ?? null;
}

function fmtSmmlv(n: number) {
  return Math.round(n).toLocaleString("es-CO");
}

function fmtCop(millones: number | null) {
  if (millones == null) return "Sin datos";
  return `${Math.round(millones / 1_000_000).toLocaleString("es-CO")} MM`;
}

export default async function CapacidadGrupoPage() {
  const capacidad = await calcularCapacidadGrupo();
  const ptarPtap = await calcularExperienciaPtarPtap();
  const informeUrl = await getInformeSociosUrl();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/reportes" className="text-sm text-slate-500 hover:text-blue-600">
        ← Reportes
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Capacidad del grupo</h1>
          <p className="text-slate-500">
            Tipo de proceso, cuantía e indicadores financieros de las empresas del grupo, calculados en
            vivo desde los datos cargados. Úsalo como primer filtro cuando llegue un pliego nuevo.
          </p>
        </div>
        {informeUrl && (
          <a
            href={informeUrl}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Download size={16} />
            Descargar informe (Word)
          </a>
        )}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        &quot;Experiencia confiable&quot; excluye contratos en ejecución, con titular no coincidente, sin %
        de participación documentado, y contratos con nota de calidad de datos (ver abajo). Antes de
        usar estas cifras en una oferta real, verifica el pliego específico y los certificados de
        soporte.
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Sectores principales</th>
              <th className="px-4 py-3">Patrimonio</th>
              <th className="px-4 py-3">Liquidez</th>
              <th className="px-4 py-3">Endeud.</th>
              <th className="px-4 py-3">Exp. confiable (SMMLV)</th>
              <th className="px-4 py-3">Mayor contrato (SMMLV)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {capacidad.map((c) => (
              <tr key={c.empresa.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/empresas/${c.empresa.id}`} className="hover:text-blue-600">
                    {c.empresa.nombre}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.sectores.length > 0
                    ? c.sectores
                        .slice(0, 3)
                        .map((s) => s.nombre)
                        .join(", ")
                    : "Sin sector registrado"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.financierosUltimoAnio
                    ? `${fmtCop(c.financierosUltimoAnio.patrimonio)} (${c.financierosUltimoAnio.periodo})`
                    : "Sin datos"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.financierosUltimoAnio?.indice_liquidez ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.financierosUltimoAnio?.indice_endeudamiento != null
                    ? `${c.financierosUltimoAnio.indice_endeudamiento}%`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {fmtSmmlv(c.experienciaConfiableSmmlv)}
                  <span className="ml-1 text-xs text-slate-400">({c.contratosConfiables} ctos.)</span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.mayorContrato ? fmtSmmlv(c.mayorContrato.smmlv) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4">
        {capacidad
          .filter((c) => c.contratosConNotaCalidad.length > 0 || c.contratosExcluidosPorDatoFaltante > 0)
          .map((c) => (
            <div key={c.empresa.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <p className="mb-2 font-medium text-slate-900">{c.empresa.nombre} — alertas de datos</p>
              {c.contratosExcluidosPorDatoFaltante > 0 && (
                <p className="text-slate-500">
                  {c.contratosExcluidosPorDatoFaltante} contrato(s) excluidos del total confiable por no
                  tener % de participación documentado (se asumen sin verificar, no se cuentan al 100%).
                </p>
              )}
              {c.contratosConNotaCalidad.map((n, i) => (
                <p key={i} className="mt-1 text-amber-700">
                  ⚠ {n.entidad}: {n.nota}
                </p>
              ))}
            </div>
          ))}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-slate-900">Experiencia en PTAR/PTAP y capacidad</h2>
        <p className="text-slate-500">
          De {ptarPtap.totalContratos} contratos del grupo relacionados con plantas de tratamiento,
          solo {ptarPtap.conCapacidadDocumentada.length} tienen el caudal o volumen documentado. Si un
          pliego exige un caudal mínimo, hoy solo se puede soportar con estos.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Entidad</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Capacidad</th>
              <th className="px-4 py-3">Participación</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ptarPtap.conCapacidadDocumentada.map((c, i) => (
              <tr key={i}>
                <td className="px-4 py-3 font-medium text-slate-900">{c.empresaNombre}</td>
                <td className="px-4 py-3 text-slate-600">{c.entidad}</td>
                <td className="px-4 py-3 text-slate-600">{c.tipo}</td>
                <td className="px-4 py-3 text-slate-600">
                  {c.caudalLps != null ? `${c.caudalLps.toLocaleString("es-CO")} LPS` : null}
                  {c.volumenM3 != null ? `${c.volumenM3.toLocaleString("es-CO")} m³` : null}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.participacionPct != null ? `${c.participacionPct}%` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{c.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <p className="mb-2 font-medium text-slate-900">
          Contratos PTAR/PTAP sin capacidad extraída ({ptarPtap.sinCapacidadDocumentada.length})
        </p>
        <div className="flex flex-col gap-1 text-slate-500">
          {ptarPtap.porEmpresa.map((p) => (
            <p key={p.empresaNombre}>
              {p.empresaNombre}: {p.total - p.conCapacidad} de {p.total} contratos sin caudal/volumen
              documentado.
            </p>
          ))}
        </div>
        <p className="mt-3 text-slate-400">
          Para usarlos en un pliego que exija un caudal mínimo, hay que sacar el certificado original de
          cada uno y extraer la capacidad.
        </p>
      </div>
    </div>
  );
}
