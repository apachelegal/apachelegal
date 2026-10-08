"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { actualizarCaso, actualizarEtapaCaso, eliminarCaso } from "../actions";
import { CasoCampos } from "../CasoCampos";
import { ETAPA_CASO_LABELS, ESTADO_CASO_LABELS, type Caso } from "@/lib/casos";
import { formatCOP, formatDate } from "@/lib/format";

export function FichaSection({ caso }: { caso: Caso }) {
  const [editando, setEditando] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<void>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        onOk?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocurrió un error");
      }
    });
  }

  if (editando) {
    return (
      <form
        action={(fd) => run(() => actualizarCaso(caso.id, fd), () => setEditando(false))}
        className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6"
      >
        <h1 className="text-lg font-semibold text-slate-900">Editar ficha del caso</h1>
        <CasoCampos caso={caso} />
        {error && <ErrorBox message={error} />}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending && <Loader2 size={16} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </form>
    );
  }

  const datos: [string, string][] = [
    ["Cliente", caso.cliente ?? "—"],
    ["Contraparte", caso.contraparte ?? "—"],
    ["Contrato", caso.contrato ?? "—"],
    ["Entidad", caso.entidad ?? "—"],
    ["Valor", formatCOP(caso.valor)],
    ["Responsable", caso.responsable ?? "—"],
    ["Inicio", formatDate(caso.fecha_inicio)],
    ["Estado", ESTADO_CASO_LABELS[caso.estado]],
  ];

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900">{caso.titulo}</h1>
          {caso.objeto && <p className="mt-1 text-sm text-slate-500">{caso.objeto}</p>}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={caso.etapa}
            disabled={isPending}
            onChange={(e) => run(() => actualizarEtapaCaso(caso.id, e.target.value))}
            aria-label="Etapa del caso"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
          >
            {Object.entries(ETAPA_CASO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setEditando(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Pencil size={14} />
            Editar
          </button>
          <button
            onClick={() => {
              if (confirm(`¿Eliminar el caso "${caso.titulo}" con todas sus tareas y documentos?`)) {
                run(() => eliminarCaso(caso.id));
              }
            }}
            disabled={isPending}
            aria-label="Eliminar caso"
            className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {datos.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
            <dd className="text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>

      {(caso.resumen || caso.posicion) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {caso.resumen && <Bloque titulo="Resumen" texto={caso.resumen} />}
          {caso.posicion && <Bloque titulo="Posición y estrategia" texto={caso.posicion} />}
        </div>
      )}
    </div>
  );
}

function Bloque({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</h2>
      <p className="whitespace-pre-line text-sm text-slate-700">{texto}</p>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>
  );
}
