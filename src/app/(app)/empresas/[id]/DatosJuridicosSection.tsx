"use client";

import { useState, useTransition } from "react";
import { Scale, Sparkles, Loader2, Plus, Check } from "lucide-react";
import { extraerDatosJuridicosAction, agregarExperienciaDesdeRup } from "./juridicos-actions";
import type { EmpresaDatosJuridicos } from "@/lib/types";
import { formatCOP, formatDate } from "@/lib/format";

export function DatosJuridicosSection({
  empresaId,
  datos,
  hayDocumentos,
}: {
  empresaId: string;
  datos: EmpresaDatosJuridicos | null;
  hayDocumentos: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [agregandoId, setAgregandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleExtraer() {
    setError(null);
    startTransition(async () => {
      try {
        await extraerDatosJuridicosAction(empresaId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al extraer los datos jurídicos");
      }
    });
  }

  function handleAgregarExperiencia(item: NonNullable<EmpresaDatosJuridicos["experiencia_rup_faltante"]>[number]) {
    const key = `${item.entidad_contratante}-${item.objeto}`;
    setAgregandoId(key);
    setError(null);
    startTransition(async () => {
      try {
        await agregarExperienciaDesdeRup(empresaId, item);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al agregar la experiencia");
      } finally {
        setAgregandoId(null);
      }
    });
  }

  const faltantes = datos?.experiencia_rup_faltante ?? [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <Scale size={18} className="text-blue-600" />
          Datos jurídicos y clasificación RUP
        </h2>
        <button
          onClick={handleExtraer}
          disabled={!hayDocumentos || isPending}
          className="flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          title={!hayDocumentos ? "Sube el RUP o la Cámara de Comercio en PDF" : undefined}
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {datos ? "Volver a extraer" : "Extraer con IA"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!datos && !isPending && (
        <p className="text-sm text-slate-400">
          {hayDocumentos
            ? "Aún no se han extraído los datos jurídicos. Haz clic en \"Extraer con IA\"."
            : "Sube el RUP y/o la Cámara de Comercio en PDF para poder extraer estos datos."}
        </p>
      )}

      {isPending && !datos && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin" />
          Leyendo los documentos, esto puede tardar un minuto...
        </p>
      )}

      {datos && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Dato label="Representante legal" value={datos.representante_legal} />
            <Dato
              label="Documento del representante"
              value={
                datos.tipo_documento_representante && datos.numero_documento_representante
                  ? `${datos.tipo_documento_representante} ${datos.numero_documento_representante}`
                  : datos.numero_documento_representante
              }
            />
            <Dato label="Fecha de constitución" value={formatDate(datos.fecha_constitucion)} />
            <Dato label="Duración de la sociedad" value={datos.duracion_sociedad} />
            <Dato label="Capital social" value={datos.capital_social != null ? formatCOP(datos.capital_social) : null} />
            <Dato label="Matrícula mercantil" value={datos.matricula_mercantil} />
            <Dato label="Última renovación" value={formatDate(datos.fecha_ultima_renovacion)} />
          </div>

          {datos.objeto_social && (
            <div>
              <p className="text-xs font-medium text-slate-500">Objeto social</p>
              <p className="mt-0.5 text-sm text-slate-700">{datos.objeto_social}</p>
            </div>
          )}

          {datos.clasificacion_rup && datos.clasificacion_rup.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">Clasificación RUP</p>
              <div className="flex flex-wrap gap-1.5">
                {datos.clasificacion_rup.map((c, i) => (
                  <span
                    key={i}
                    title={c.descripcion}
                    className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
                  >
                    {c.codigo} · {c.descripcion}
                  </span>
                ))}
              </div>
            </div>
          )}

          {faltantes.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">
                Experiencia certificada en el RUP que no está registrada ({faltantes.length})
              </p>
              <ul className="space-y-2">
                {faltantes.map((item, i) => {
                  const key = `${item.entidad_contratante}-${item.objeto}`;
                  return (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">{item.entidad_contratante}</p>
                        <p className="text-sm text-slate-600">{item.objeto}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {item.valor != null && formatCOP(item.valor)}
                          {item.fecha_inicio && ` · ${formatDate(item.fecha_inicio)}`}
                          {item.fecha_terminacion && ` – ${formatDate(item.fecha_terminacion)}`}
                          {item.numero_contrato && ` · Contrato ${item.numero_contrato}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAgregarExperiencia(item)}
                        disabled={isPending}
                        className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 shadow-sm hover:bg-blue-50 disabled:opacity-50"
                      >
                        {agregandoId === key ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Plus size={12} />
                        )}
                        Agregar a experiencia
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {faltantes.length === 0 && datos.experiencia_rup_faltante != null && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-600">
              <Check size={14} />
              Toda la experiencia certificada en el RUP ya está registrada en el sistema.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
