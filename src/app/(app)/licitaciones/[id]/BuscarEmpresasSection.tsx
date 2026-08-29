"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, HelpCircle, Loader2, Search, Users2 } from "lucide-react";
import { buscarEmpresasRecomendadas, agregarGrupoComoParticipantes } from "./buscar-empresas-actions";
import type { ResultadoEmpresaIndividual, GrupoConsorcioSugerido } from "@/lib/scoring";

const VEREDICTO_STYLES = {
  cumple: { icon: CheckCircle2, className: "text-emerald-600 bg-emerald-50", label: "Cumple" },
  no_cumple: { icon: XCircle, className: "text-red-600 bg-red-50", label: "No cumple" },
  sin_datos: { icon: HelpCircle, className: "text-slate-500 bg-slate-100", label: "Sin datos" },
} as const;

function puntajeMasReciente(financiero: ResultadoEmpresaIndividual["financiero"]): string {
  if (financiero.length === 0) return "—";
  return financiero.map((f) => `${f.periodo}: ${f.puntajeTotal.toFixed(0)} pts`).join(" · ");
}

export function BuscarEmpresasSection({
  licitacionId,
  puedeBuscar,
}: {
  licitacionId: string;
  puedeBuscar: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    individuales: ResultadoEmpresaIndividual[];
    grupos: GrupoConsorcioSugerido[];
  } | null>(null);
  const [usandoGrupo, setUsandoGrupo] = useState<number | null>(null);
  const [usandoIndividual, setUsandoIndividual] = useState<string | null>(null);

  function handleBuscar() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await buscarEmpresasRecomendadas(licitacionId);
        setResultado(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al buscar empresas recomendadas");
      }
    });
  }

  async function handleUsarIndividual(empresaId: string) {
    setUsandoIndividual(empresaId);
    try {
      await agregarGrupoComoParticipantes(licitacionId, [{ empresaId, porcentaje: 100 }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al agregar la empresa");
    } finally {
      setUsandoIndividual(null);
    }
  }

  async function handleUsarGrupo(index: number, grupo: GrupoConsorcioSugerido) {
    setUsandoGrupo(index);
    try {
      await agregarGrupoComoParticipantes(
        licitacionId,
        grupo.integrantes.map((i) => ({ empresaId: i.empresaId, porcentaje: i.porcentaje })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al agregar la combinación");
    } finally {
      setUsandoGrupo(null);
    }
  }

  const gruposFactibles = (resultado?.grupos ?? []).filter((g) => g.factible);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <Search size={18} className="text-blue-600" />
          Buscar empresas recomendadas
        </h2>
        <button
          onClick={handleBuscar}
          disabled={!puedeBuscar || isPending}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Buscar empresas recomendadas
        </button>
      </div>

      <p className="mb-4 text-xs text-slate-400">
        Calcula, con las cifras reales registradas de cada empresa (sin usar IA en este paso), qué
        tan cerca está cada una de cumplir sola, y qué combinaciones de consorcio alcanzarían el
        mínimo de experiencia y financiero exigidos.
      </p>

      {!puedeBuscar && (
        <p className="text-sm text-slate-400">Analiza el pliego con IA antes de buscar empresas recomendadas.</p>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {resultado && (
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-800">Empresas individuales</h3>
            {resultado.individuales.length === 0 ? (
              <p className="text-sm text-slate-400">No hay empresas registradas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Empresa</th>
                      <th className="py-2 pr-4 font-medium">Experiencia elegible (SMMLV)</th>
                      <th className="py-2 pr-4 font-medium">Financiero por año</th>
                      <th className="py-2 pr-4 font-medium">Veredicto</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resultado.individuales.map((r) => {
                      const { icon: Icon, className, label } = VEREDICTO_STYLES[r.veredicto];
                      return (
                        <tr key={r.empresaId}>
                          <td className="py-2 pr-4 font-medium text-slate-800">{r.nombre}</td>
                          <td className="py-2 pr-4 text-slate-600">
                            {r.tecnico.valorSmmlvElegible.toLocaleString("es-CO", { maximumFractionDigits: 1 })}
                          </td>
                          <td className="py-2 pr-4 text-slate-600">{puntajeMasReciente(r.financiero)}</td>
                          <td className="py-2 pr-4">
                            <span className={`flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
                              <Icon size={12} />
                              {label}
                            </span>
                          </td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => handleUsarIndividual(r.empresaId)}
                              disabled={usandoIndividual === r.empresaId}
                              className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                            >
                              {usandoIndividual === r.empresaId ? "Agregando..." : "Usar esta empresa"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
              <Users2 size={16} className="text-slate-400" />
              Combinaciones de consorcio sugeridas
            </h3>
            {gruposFactibles.length === 0 ? (
              <p className="text-sm text-slate-400">
                Ninguna combinación de las empresas registradas alcanza ambos requisitos (experiencia
                y financiero) al mismo tiempo.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {gruposFactibles.map((g, i) => (
                  <div key={i} className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">
                        {g.integrantes.map((it) => `${it.nombre} ${it.porcentaje}%`).join(" + ")}
                      </p>
                      <button
                        onClick={() => handleUsarGrupo(i, g)}
                        disabled={usandoGrupo === i}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {usandoGrupo === i ? "Agregando..." : "Usar esta combinación"}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600">
                      Experiencia ponderada:{" "}
                      {g.experienciaResultanteSmmlv.toLocaleString("es-CO", { maximumFractionDigits: 1 })} SMMLV
                      {" · "}Financiero: {puntajeMasReciente(g.financieroResultantePorAnio)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
