"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, ClipboardCheck, Loader2, Sparkles } from "lucide-react";
import { alternarSeleccionExperiencia, sugerirSeleccionExperiencia } from "./seleccion-actions";
import type { Experiencia, LicitacionExperienciaSeleccionada } from "@/lib/types";
import { formatCOP, formatDate } from "@/lib/format";

interface EmpresaConExperiencia {
  empresaId: string;
  nombre: string;
  experiencia: Experiencia[];
}

export function SeleccionExperienciaSection({
  licitacionId,
  empresas,
  seleccionActual,
  puedeSugerir,
  motivoBloqueo,
}: {
  licitacionId: string;
  empresas: EmpresaConExperiencia[];
  seleccionActual: Map<string, LicitacionExperienciaSeleccionada>;
  puedeSugerir: boolean;
  motivoBloqueo: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [sugiriendo, setSugiriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(empresas[0]?.empresaId ?? null);

  const totalExperiencia = empresas.reduce((sum, e) => sum + e.experiencia.length, 0);
  const totalSeleccionados = seleccionActual.size;

  async function handleSugerir() {
    setError(null);
    setResumen(null);
    setSugiriendo(true);
    try {
      const resultado = await sugerirSeleccionExperiencia(licitacionId);
      setResumen(resultado.resumen);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al sugerir la selección con IA");
    } finally {
      setSugiriendo(false);
    }
  }

  function handleToggle(experienciaId: string, marcado: boolean) {
    startTransition(() => alternarSeleccionExperiencia(licitacionId, experienciaId, marcado));
  }

  if (totalExperiencia === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <ClipboardCheck size={18} className="text-blue-600" />
          Selección de experiencia para el Formulario No. 2
        </h2>
        <button
          onClick={handleSugerir}
          disabled={!puedeSugerir || sugiriendo}
          className="flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          title={!puedeSugerir ? (motivoBloqueo ?? undefined) : undefined}
        >
          {sugiriendo ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Sugerir con IA
        </button>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Muchos pliegos limitan cuántos contratos se pueden citar como experiencia habilitante (ej.
        máximo 4 por RUP). Marca aquí cuáles vas a citar — el Formulario No. 2 solo incluirá los
        marcados. Si no marcas ninguno, el Excel incluye toda la experiencia disponible.
        {totalSeleccionados > 0 && (
          <span className="ml-1 font-medium text-emerald-600">
            {totalSeleccionados} de {totalExperiencia} contratos seleccionados.
          </span>
        )}
      </p>

      {resumen && (
        <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <span className="font-medium">IA:</span> {resumen}
        </p>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {empresas.map((e) => {
          const abierto = expandido === e.empresaId;
          const seleccionadosEmpresa = e.experiencia.filter((exp) => seleccionActual.has(exp.id)).length;
          return (
            <div key={e.empresaId} className="rounded-lg border border-slate-200">
              <button
                onClick={() => setExpandido(abierto ? null : e.empresaId)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-800"
              >
                <span>
                  {e.nombre}{" "}
                  <span className="font-normal text-slate-400">
                    ({seleccionadosEmpresa} de {e.experiencia.length} seleccionados)
                  </span>
                </span>
                {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {abierto && (
                <ul className="divide-y divide-slate-100 border-t border-slate-100 px-3">
                  {e.experiencia.map((exp) => {
                    const seleccion = seleccionActual.get(exp.id);
                    return (
                      <li key={exp.id} className="flex items-start gap-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={!!seleccion}
                          disabled={isPending}
                          onChange={(ev) => handleToggle(exp.id, ev.target.checked)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-slate-800">{exp.entidad_contratante}</p>
                            {seleccion?.origen === "ia" && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                Sugerido por IA
                              </span>
                            )}
                            {seleccion?.actividad_acreditada && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                {seleccion.actividad_acreditada}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{exp.objeto}</p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {formatDate(exp.fecha_inicio)} – {formatDate(exp.fecha_terminacion)} ·{" "}
                            {formatCOP(exp.valor)}
                            {exp.valor_smmlv != null && <> · {exp.valor_smmlv} SMMLV</>}
                            {exp.codigo_unspsc && <> · UNSPSC {exp.codigo_unspsc}</>}
                          </p>
                          {seleccion?.justificacion && (
                            <p className="mt-1 text-xs italic text-slate-500">{seleccion.justificacion}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
