"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, Scale, Landmark, Wrench, Paperclip, CalendarClock } from "lucide-react";
import { analizarLicitacion } from "./ai-actions";
import type { AnalisisLicitacion, RequisitoAnalisis } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function AnalisisIASection({
  licitacionId,
  analisis,
  hayPdfs,
}: {
  licitacionId: string;
  analisis: AnalisisLicitacion | null;
  hayPdfs: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAnalizar() {
    setError(null);
    startTransition(async () => {
      try {
        await analizarLicitacion(licitacionId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al analizar con IA");
      }
    });
  }

  const procesando = isPending || analisis?.estado === "procesando";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <Sparkles size={18} className="text-blue-600" />
          Análisis IA del pliego
        </h2>
        <button
          onClick={handleAnalizar}
          disabled={!hayPdfs || procesando}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {procesando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {analisis ? "Volver a analizar" : "Analizar con IA"}
        </button>
      </div>

      {!hayPdfs && (
        <p className="text-sm text-slate-400">
          Sube el pliego (o sus anexos) en formato PDF en la sección de Documentos para poder analizarlo.
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && analisis?.estado === "error" && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {analisis.error_mensaje ?? "El último análisis falló. Intenta de nuevo."}
        </div>
      )}

      {procesando && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin" />
          Leyendo el pliego y los anexos, esto puede tardar un minuto...
        </p>
      )}

      {!procesando && analisis?.estado === "completado" && (
        <div className="flex flex-col gap-6">
          {analisis.resumen && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-slate-800">Resumen</h3>
              <p className="text-sm leading-relaxed text-slate-600">{analisis.resumen}</p>
            </div>
          )}

          <RequisitosGrupo
            icon={Scale}
            titulo="Requisitos jurídicos"
            items={analisis.requisitos_juridicos}
          />
          <RequisitosGrupo
            icon={Landmark}
            titulo="Requisitos financieros"
            items={analisis.requisitos_financieros}
          />
          <RequisitosGrupo
            icon={Wrench}
            titulo="Requisitos técnicos"
            items={analisis.requisitos_tecnicos}
          />

          {analisis.anexos_detectados && analisis.anexos_detectados.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                <Paperclip size={16} className="text-slate-400" />
                Anexos y formatos requeridos
              </h3>
              <ul className="space-y-2">
                {analisis.anexos_detectados.map((anexo, i) => (
                  <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">{anexo.nombre}</span>
                      {anexo.obligatorio && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Obligatorio
                        </span>
                      )}
                    </div>
                    {anexo.descripcion && (
                      <p className="mt-0.5 text-xs text-slate-500">{anexo.descripcion}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analisis.fechas_clave && analisis.fechas_clave.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                <CalendarClock size={16} className="text-slate-400" />
                Fechas clave del cronograma
              </h3>
              <ul className="divide-y divide-slate-100">
                {analisis.fechas_clave.map((f, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-700">{f.evento}</span>
                    <span className="text-slate-500">{f.fecha ? formatDate(f.fecha) : "Sin fecha"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analisis.modelo && (
            <p className="text-xs text-slate-400">
              Generado con {analisis.modelo} · {formatDate(analisis.updated_at.slice(0, 10))}
            </p>
          )}
        </div>
      )}

      {!procesando && !analisis && hayPdfs && (
        <p className="text-sm text-slate-400">
          Aún no se ha analizado esta licitación. Haz clic en &quot;Analizar con IA&quot; para extraer el
          resumen y los requisitos automáticamente.
        </p>
      )}
    </div>
  );
}

function RequisitosGrupo({
  icon: Icon,
  titulo,
  items,
}: {
  icon: typeof Scale;
  titulo: string;
  items: RequisitoAnalisis[] | null;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
        <Icon size={16} className="text-slate-400" />
        {titulo}
      </h3>
      <ul className="space-y-2">
        {items.map((req, i) => (
          <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <p className="font-medium text-slate-800">{req.requisito}</p>
            {req.detalle && <p className="mt-0.5 text-slate-600">{req.detalle}</p>}
            {req.fuente && <p className="mt-0.5 text-xs text-slate-400">Fuente: {req.fuente}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
