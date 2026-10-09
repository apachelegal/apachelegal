"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { archivarEmpresa } from "../actions";

export function ArchivarEmpresaButton({ id, archivada }: { id: string; archivada: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => {
          setError(null);
          if (
            !archivada &&
            !confirm(
              "¿Archivar esta empresa? Deja de aparecer en las listas, la habilitación y el recomendador, pero conserva todos sus datos y puedes restaurarla cuando quieras.",
            )
          ) {
            return;
          }
          startTransition(async () => {
            try {
              await archivarEmpresa(id, !archivada);
            } catch (e) {
              // El redirect de una acción de servidor llega como excepción: se deja pasar.
              if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) throw e;
              setError(e instanceof Error ? e.message : "No se pudo completar la acción");
            }
          });
        }}
        disabled={isPending}
        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : archivada ? (
          <ArchiveRestore size={16} />
        ) : (
          <Archive size={16} />
        )}
        {archivada ? "Restaurar" : "Archivar"}
      </button>
      {error && <p className="max-w-xs text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
