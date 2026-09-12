"use client";

import { useTransition } from "react";
import { Loader2, Milestone } from "lucide-react";
import { actualizarRolEmpresa } from "../actions";

export function RolEmpresaSection({
  empresaId,
  participaLicitaciones,
  ejecutaObra,
}: {
  empresaId: string;
  participaLicitaciones: boolean;
  ejecutaObra: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function actualizar(campo: "participa_licitaciones" | "ejecuta_obra", valor: boolean) {
    startTransition(() =>
      actualizarRolEmpresa(empresaId, {
        participa_licitaciones: campo === "participa_licitaciones" ? valor : participaLicitaciones,
        ejecuta_obra: campo === "ejecuta_obra" ? valor : ejecutaObra,
      }),
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 flex items-center gap-2 font-medium text-slate-900">
        <Milestone size={18} className="text-blue-600" />
        Rol en el grupo
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        No son excluyentes: una empresa puede licitar y también ejecutar la obra.
      </p>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={participaLicitaciones}
            disabled={isPending}
            onChange={(e) => actualizar("participa_licitaciones", e.target.checked)}
            className="rounded border-slate-300"
          />
          Participa en licitaciones
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={ejecutaObra}
            disabled={isPending}
            onChange={(e) => actualizar("ejecuta_obra", e.target.checked)}
            className="rounded border-slate-300"
          />
          Ejecuta obra
        </label>

        {isPending && <Loader2 size={16} className="animate-spin text-slate-400" />}
      </div>
    </div>
  );
}
