"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { agregarParticipante, eliminarParticipante } from "./participantes-actions";
import type { Empresa } from "@/lib/types";

interface Participante {
  id: string;
  empresa_id: string;
  porcentaje_participacion: number;
}

export function ParticipantesSection({
  licitacionId,
  participantes,
  empresas,
}: {
  licitacionId: string;
  participantes: Participante[];
  empresas: Empresa[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const empresasPorId = new Map(empresas.map((e) => [e.id, e]));
  const disponibles = empresas.filter((e) => !participantes.some((p) => p.empresa_id === e.id));
  const totalPct = participantes.reduce((sum, p) => sum + p.porcentaje_participacion, 0);

  function handleAgregar(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await agregarParticipante(licitacionId, formData);
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al agregar la empresa");
      }
    });
  }

  function handleEliminar(participanteId: string) {
    setError(null);
    startTransition(() => eliminarParticipante(licitacionId, participanteId));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <Users size={18} className="text-blue-600" />
          Participantes
        </h2>
        {participantes.length > 1 && (
          <span className={`text-xs ${totalPct === 100 ? "text-emerald-600" : "text-amber-600"}`}>
            Participación total: {totalPct}%
          </span>
        )}
      </div>

      {empresas.length === 0 ? (
        <p className="text-sm text-slate-400">
          No hay empresas registradas todavía.{" "}
          <Link href="/empresas/nueva" className="text-blue-600 hover:underline">
            Crea una empresa
          </Link>{" "}
          para poder verificar el cumplimiento de requisitos.
        </p>
      ) : (
        <>
          {disponibles.length > 0 && (
            <form
              ref={formRef}
              action={handleAgregar}
              className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 p-4"
            >
              <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Empresa</label>
                <select
                  name="empresa_id"
                  required
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Selecciona...</option>
                  {disponibles.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Participación (%)</label>
                <input
                  name="porcentaje_participacion"
                  type="number"
                  min="1"
                  max="100"
                  defaultValue={participantes.length === 0 ? 100 : ""}
                  placeholder="100"
                  className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus size={16} />
                Agregar
              </button>
            </form>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {participantes.length === 0 ? (
            <p className="text-sm text-slate-400">
              Sin participantes definidos. Agrega tu empresa (100% si vas sola) o las empresas del
              consorcio/unión temporal con su % de participación.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {participantes.map((p) => {
                const empresa = empresasPorId.get(p.empresa_id);
                return (
                  <li key={p.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm font-medium text-slate-800">
                      {empresa?.nombre ?? "Empresa eliminada"}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-600">{p.porcentaje_participacion}%</span>
                      <button
                        onClick={() => handleEliminar(p.id)}
                        disabled={isPending}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label="Quitar"
                      >
                        {isPending ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
