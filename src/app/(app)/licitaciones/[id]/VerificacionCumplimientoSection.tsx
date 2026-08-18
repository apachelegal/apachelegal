"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Loader2,
  ShieldCheck,
  Scale,
  Landmark,
  Wrench,
} from "lucide-react";
import { verificarCumplimientoAction } from "./verificacion-actions";
import type { RequisitoVerificado, VerificacionCumplimiento, VeredictoCumplimiento } from "@/lib/types";
import { VEREDICTO_LABELS } from "@/lib/types";

const VEREDICTO_STYLES: Record<VeredictoCumplimiento, { icon: typeof CheckCircle2; className: string }> = {
  si: { icon: CheckCircle2, className: "text-emerald-600 bg-emerald-50" },
  no: { icon: XCircle, className: "text-red-600 bg-red-50" },
  parcial: { icon: AlertTriangle, className: "text-amber-600 bg-amber-50" },
  no_determinable: { icon: HelpCircle, className: "text-slate-500 bg-slate-100" },
};

const CATEGORIA_LABELS = {
  juridico: "Requisitos jurídicos",
  financiero: "Requisitos financieros",
  tecnico: "Requisitos técnicos",
} as const;

const CATEGORIA_ICONS = {
  juridico: Scale,
  financiero: Landmark,
  tecnico: Wrench,
} as const;

export function VerificacionCumplimientoSection({
  licitacionId,
  verificacion,
  puedeVerificar,
  motivoBloqueo,
}: {
  licitacionId: string;
  verificacion: VerificacionCumplimiento | null;
  puedeVerificar: boolean;
  motivoBloqueo: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleVerificar() {
    setError(null);
    startTransition(async () => {
      try {
        await verificarCumplimientoAction(licitacionId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al verificar el cumplimiento");
      }
    });
  }

  const procesando = isPending || verificacion?.estado === "procesando";
  const resultados = verificacion?.resultados ?? [];
  const porCategoria = (cat: keyof typeof CATEGORIA_LABELS) => resultados.filter((r) => r.categoria === cat);

  const totalSi = resultados.filter((r) => r.cumple === "si").length;
  const totalConProblema = resultados.filter((r) => r.cumple === "no" || r.cumple === "parcial");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <ShieldCheck size={18} className="text-blue-600" />
          Verificación de cumplimiento
        </h2>
        <button
          onClick={handleVerificar}
          disabled={!puedeVerificar || procesando}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {procesando ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          {verificacion ? "Volver a verificar" : "Verificar cumplimiento"}
        </button>
      </div>

      <p className="mb-4 text-xs text-slate-400">
        Estimación generada por IA a partir de los datos que registraste — no reemplaza la revisión
        de un abogado ni garantiza el resultado de la evaluación oficial.
      </p>

      {!puedeVerificar && motivoBloqueo && (
        <p className="text-sm text-slate-400">{motivoBloqueo}</p>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && verificacion?.estado === "error" && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {verificacion.error_mensaje ?? "La última verificación falló. Intenta de nuevo."}
        </div>
      )}

      {procesando && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin" />
          Comparando requisitos contra los datos registrados, esto puede tardar un minuto...
        </p>
      )}

      {!procesando && verificacion?.estado === "completado" && (
        <div className="flex flex-col gap-6">
          {verificacion.resumen && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-slate-800">Resumen</h3>
              <p className="text-sm leading-relaxed text-slate-600">{verificacion.resumen}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
              {totalSi} cumplen
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
              {resultados.length} evaluados en total
            </span>
          </div>

          {totalConProblema.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="mb-2 text-sm font-medium text-amber-800">Qué falta resolver</h3>
              <ul className="space-y-1.5">
                {totalConProblema.map((r, i) => (
                  <li key={i} className="text-sm text-amber-800">
                    <span className="font-medium">{r.requisito}:</span>{" "}
                    {r.que_falta || r.justificacion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(["juridico", "financiero", "tecnico"] as const).map((cat) => {
            const items = porCategoria(cat);
            if (items.length === 0) return null;
            const Icon = CATEGORIA_ICONS[cat];
            return (
              <div key={cat}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Icon size={16} className="text-slate-400" />
                  {CATEGORIA_LABELS[cat]}
                </h3>
                <ul className="space-y-2">
                  {items.map((r, i) => (
                    <RequisitoRow key={i} r={r} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {!procesando && !verificacion && puedeVerificar && (
        <p className="text-sm text-slate-400">
          Aún no se ha verificado el cumplimiento. Haz clic en &quot;Verificar cumplimiento&quot;
          para comparar los requisitos del pliego contra los datos de tu empresa.
        </p>
      )}
    </div>
  );
}

function RequisitoRow({ r }: { r: RequisitoVerificado }) {
  const { icon: Icon, className } = VEREDICTO_STYLES[r.cumple];
  return (
    <li className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-slate-800">{r.requisito}</p>
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
          <Icon size={12} />
          {VEREDICTO_LABELS[r.cumple]}
        </span>
      </div>
      <p className="mt-0.5 text-slate-600">{r.justificacion}</p>
      {r.que_falta && r.cumple !== "si" && (
        <p className="mt-0.5 text-xs text-slate-500">
          <span className="font-medium">Falta:</span> {r.que_falta}
        </p>
      )}
    </li>
  );
}
