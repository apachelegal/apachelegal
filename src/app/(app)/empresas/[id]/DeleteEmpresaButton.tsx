"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { eliminarEmpresa } from "../actions";

export function DeleteEmpresaButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        if (confirm("¿Eliminar esta empresa, sus indicadores y toda su experiencia registrada?")) {
          startTransition(() => eliminarEmpresa(id));
        }
      }}
      disabled={isPending}
      className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
      Eliminar
    </button>
  );
}
