"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Landmark, Loader2, ExternalLink } from "lucide-react";
import { vincularEntidad } from "./entidad-actions";
import type { EntidadContratante } from "@/lib/types";

export function EntidadVinculadaSection({
  licitacionId,
  entidadIdActual,
  entidades,
  manualesCount,
}: {
  licitacionId: string;
  entidadIdActual: string | null;
  entidades: EntidadContratante[];
  manualesCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(entidadId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await vincularEntidad(licitacionId, entidadId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al vincular la entidad");
      }
    });
  }

  const entidadActual = entidades.find((e) => e.id === entidadIdActual);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 font-medium text-slate-900">
        <Landmark size={18} className="text-blue-600" />
        Entidad contratante (manual de contratación)
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={entidadIdActual ?? ""}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isPending}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">Sin vincular</option>
          {entidades.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        {isPending && <Loader2 size={16} className="animate-spin text-slate-400" />}
        {entidadActual && (
          <Link
            href={`/entidades/${entidadActual.id}`}
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            Ver entidad
            <ExternalLink size={12} />
          </Link>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {entidadIdActual && (
        <p className="mt-2 text-xs text-slate-500">
          {manualesCount > 0
            ? `${manualesCount} ${manualesCount === 1 ? "manual" : "manuales"} de contratación se incluirán como contexto al analizar el pliego con IA.`
            : "Esta entidad no tiene manual de contratación cargado todavía."}
        </p>
      )}
      {!entidadIdActual && (
        <p className="mt-2 text-xs text-slate-400">
          Vincula la entidad contratante para que su manual de contratación (si tiene uno cargado)
          se use automáticamente al analizar el pliego.{" "}
          <Link href="/entidades/nueva" className="text-blue-600 hover:underline">
            Crear entidad
          </Link>
          .
        </p>
      )}
    </div>
  );
}
