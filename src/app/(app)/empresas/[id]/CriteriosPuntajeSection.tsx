"use client";

import { useTransition } from "react";
import { Award, Loader2 } from "lucide-react";
import { actualizarCriteriosEmpresa } from "../actions";

function TriStateSelect({
  value,
  onChange,
  disabled,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value === null ? "" : value ? "si" : "no"}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "si")}
      disabled={disabled}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
    >
      <option value="">Sin verificar</option>
      <option value="si">Sí</option>
      <option value="no">No</option>
    </select>
  );
}

export function CriteriosPuntajeSection({
  empresaId,
  registraObrasInconclusas,
  esEmpresaMujeres,
}: {
  empresaId: string;
  registraObrasInconclusas: boolean | null;
  esEmpresaMujeres: boolean | null;
}) {
  const [isPending, startTransition] = useTransition();

  function actualizar(campo: "registra_obras_inconclusas" | "es_empresa_mujeres", valor: boolean | null) {
    startTransition(() =>
      actualizarCriteriosEmpresa(empresaId, {
        registra_obras_inconclusas: campo === "registra_obras_inconclusas" ? valor : registraObrasInconclusas,
        es_empresa_mujeres: campo === "es_empresa_mujeres" ? valor : esEmpresaMujeres,
      }),
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 flex items-center gap-2 font-medium text-slate-900">
        <Award size={18} className="text-blue-600" />
        Criterios de puntaje adicional
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        No afectan la habilitación, pero suman puntos en la evaluación de muchas entidades (ej. la
        EAAB otorga hasta 100 puntos por no tener obras inconclusas y 2,5 por emprendimiento/empresa
        de mujeres).
      </p>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            ¿Registra obras inconclusas? (Registro de Obras Inconclusas)
          </label>
          <TriStateSelect
            value={registraObrasInconclusas}
            disabled={isPending}
            onChange={(v) => actualizar("registra_obras_inconclusas", v)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            ¿Es empresa / emprendimiento de mujeres acreditado?
          </label>
          <TriStateSelect
            value={esEmpresaMujeres}
            disabled={isPending}
            onChange={(v) => actualizar("es_empresa_mujeres", v)}
          />
        </div>

        {isPending && <Loader2 size={16} className="animate-spin text-slate-400" />}
      </div>
    </div>
  );
}
