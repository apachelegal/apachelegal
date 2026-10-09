"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { actualizarCategoriaEmpresa } from "../actions";
import type { CategoriaEmpresa } from "@/lib/types";

export function CategoriaSelector({ empresaId, categoria }: { empresaId: string; categoria: CategoriaEmpresa }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={categoria}
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.value as CategoriaEmpresa;
          startTransition(() => actualizarCategoriaEmpresa(empresaId, value));
        }}
        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
      >
        <option value="grupo">Empresa del grupo</option>
        <option value="socio_potencial">Posible socio de consorcio</option>
      </select>
      {isPending && <Loader2 size={14} className="animate-spin text-slate-400" />}
    </div>
  );
}
