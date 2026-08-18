"use client";

import { useTransition } from "react";
import { updateLicitacionEstado } from "../actions";
import { ESTADO_LABELS, type EstadoLicitacion } from "@/lib/types";

export function EstadoSelector({ id, estado }: { id: string; estado: EstadoLicitacion }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={estado}
      disabled={isPending}
      onChange={(e) => startTransition(() => updateLicitacionEstado(id, e.target.value))}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
    >
      {Object.entries(ESTADO_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
