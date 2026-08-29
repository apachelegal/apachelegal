"use client";

import { useRef, useState, useTransition } from "react";
import { Landmark, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { guardarIndicadores, eliminarIndicadores } from "../actions";
import { extraerIndicadoresAction } from "./indicadores-actions";
import type { IndicadorFinanciero } from "@/lib/types";
import { formatCOP } from "@/lib/format";

const CAMPOS = [
  "periodo",
  "patrimonio",
  "capital_trabajo",
  "indice_liquidez",
  "indice_endeudamiento",
  "razon_cobertura_intereses",
  "rentabilidad_patrimonio",
  "rentabilidad_activo",
  "activo_corriente",
  "pasivo_corriente",
  "activo_total",
  "pasivo_total",
  "utilidad_operacional",
  "gastos_financieros",
  "efectivo_generado_operacion",
  "efectivo_y_equivalentes",
  "deuda_financiera",
] as const;

export function IndicadoresSection({
  empresaId,
  indicadores,
  hayDocumentosRup,
}: {
  empresaId: string;
  indicadores: IndicadorFinanciero[];
  hayDocumentosRup: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [extrayendo, setExtrayendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notaExtraccion, setNotaExtraccion] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRefs = useRef<Partial<Record<(typeof CAMPOS)[number], HTMLInputElement>>>({});

  function handleGuardar(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await guardarIndicadores(empresaId, formData);
        formRef.current?.reset();
        setNotaExtraccion(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar los indicadores");
      }
    });
  }

  function handleEliminar(id: string) {
    if (!confirm("¿Eliminar los indicadores de este período?")) return;
    startTransition(() => eliminarIndicadores(empresaId, id));
  }

  async function handleExtraer() {
    setError(null);
    setNotaExtraccion(null);
    setExtrayendo(true);
    try {
      const resultado = await extraerIndicadoresAction(empresaId);
      for (const campo of CAMPOS) {
        const input = inputRefs.current[campo];
        const valor = resultado[campo];
        if (input) input.value = valor != null ? String(valor) : "";
      }
      if (resultado.notas) setNotaExtraccion(resultado.notas);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al extraer los indicadores con IA");
    } finally {
      setExtrayendo(false);
    }
  }

  const ordenados = [...indicadores].sort((a, b) => b.periodo.localeCompare(a.periodo));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <Landmark size={18} className="text-blue-600" />
          Indicadores financieros
        </h2>
        <button
          onClick={handleExtraer}
          disabled={!hayDocumentosRup || extrayendo}
          className="flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          title={!hayDocumentosRup ? "Sube el RUP en PDF en Documentos de la empresa" : undefined}
        >
          {extrayendo ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Extraer del RUP con IA
        </button>
      </div>

      <form
        ref={formRef}
        action={handleGuardar}
        className="mb-5 flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 p-4"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field
            label="Período (año)"
            name="periodo"
            required
            placeholder="2025"
            inputRef={(el) => (inputRefs.current.periodo = el ?? undefined)}
          />
          <Field
            label="Patrimonio (COP)"
            name="patrimonio"
            type="number"
            inputRef={(el) => (inputRefs.current.patrimonio = el ?? undefined)}
          />
          <Field
            label="Capital de trabajo (COP)"
            name="capital_trabajo"
            type="number"
            inputRef={(el) => (inputRefs.current.capital_trabajo = el ?? undefined)}
          />
          <Field
            label="Índice de liquidez"
            name="indice_liquidez"
            type="number"
            step="0.01"
            inputRef={(el) => (inputRefs.current.indice_liquidez = el ?? undefined)}
          />
          <Field
            label="Índice de endeudamiento (%)"
            name="indice_endeudamiento"
            type="number"
            step="0.01"
            inputRef={(el) => (inputRefs.current.indice_endeudamiento = el ?? undefined)}
          />
          <Field
            label="Rentabilidad del patrimonio (%)"
            name="rentabilidad_patrimonio"
            type="number"
            step="0.01"
            inputRef={(el) => (inputRefs.current.rentabilidad_patrimonio = el ?? undefined)}
          />
          <Field
            label="Rentabilidad del activo (%)"
            name="rentabilidad_activo"
            type="number"
            step="0.01"
            inputRef={(el) => (inputRefs.current.rentabilidad_activo = el ?? undefined)}
          />
          <Field
            label="Razón cobertura intereses"
            name="razon_cobertura_intereses"
            type="number"
            step="0.01"
            inputRef={(el) => (inputRefs.current.razon_cobertura_intereses = el ?? undefined)}
          />
        </div>

        <div className="mt-1 border-t border-dashed border-slate-200 pt-3">
          <p className="mb-2 text-xs font-medium text-slate-500">
            Valores contables base (opcionales) — necesarios para combinar correctamente los
            indicadores cuando esta empresa participe en un consorcio o unión temporal.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field
              label="Activo corriente (COP)"
              name="activo_corriente"
              type="number"
              inputRef={(el) => (inputRefs.current.activo_corriente = el ?? undefined)}
            />
            <Field
              label="Pasivo corriente (COP)"
              name="pasivo_corriente"
              type="number"
              inputRef={(el) => (inputRefs.current.pasivo_corriente = el ?? undefined)}
            />
            <Field
              label="Activo total (COP)"
              name="activo_total"
              type="number"
              inputRef={(el) => (inputRefs.current.activo_total = el ?? undefined)}
            />
            <Field
              label="Pasivo total (COP)"
              name="pasivo_total"
              type="number"
              inputRef={(el) => (inputRefs.current.pasivo_total = el ?? undefined)}
            />
            <Field
              label="Utilidad operacional (COP)"
              name="utilidad_operacional"
              type="number"
              inputRef={(el) => (inputRefs.current.utilidad_operacional = el ?? undefined)}
            />
            <Field
              label="Gastos financieros (COP)"
              name="gastos_financieros"
              type="number"
              inputRef={(el) => (inputRefs.current.gastos_financieros = el ?? undefined)}
            />
          </div>
        </div>

        <div className="border-t border-dashed border-slate-200 pt-3">
          <p className="mb-2 text-xs font-medium text-slate-500">
            Estado de flujos de efectivo (opcional) — solo si el documento fuente lo trae; necesario
            para calcular Cobertura de Intereses y Múltiplo de Deuda Neta reales, sin aproximarlos.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field
              label="Efectivo generado por operación (COP)"
              name="efectivo_generado_operacion"
              type="number"
              inputRef={(el) => (inputRefs.current.efectivo_generado_operacion = el ?? undefined)}
            />
            <Field
              label="Efectivo y equivalentes (COP)"
              name="efectivo_y_equivalentes"
              type="number"
              inputRef={(el) => (inputRefs.current.efectivo_y_equivalentes = el ?? undefined)}
            />
            <Field
              label="Deuda financiera (COP)"
              name="deuda_financiera"
              type="number"
              inputRef={(el) => (inputRefs.current.deuda_financiera = el ?? undefined)}
            />
          </div>
        </div>

        {notaExtraccion && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <span className="font-medium">IA:</span> {notaExtraccion} Revisa los valores antes de
            guardar.
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Guardar período
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {ordenados.length === 0 ? (
        <p className="text-sm text-slate-400">
          Sin indicadores financieros registrados. Agrega el período más reciente (ej. cierre 2025)
          o extráelos automáticamente del RUP.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Período</th>
                <th className="py-2 pr-4 font-medium">Patrimonio</th>
                <th className="py-2 pr-4 font-medium">Capital trabajo</th>
                <th className="py-2 pr-4 font-medium">Liquidez</th>
                <th className="py-2 pr-4 font-medium">Endeudamiento</th>
                <th className="py-2 pr-4 font-medium">Rent. patrimonio</th>
                <th className="py-2 pr-4 font-medium">Rent. activo</th>
                <th className="py-2 pr-4 font-medium">Base contable</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordenados.map((ind) => {
                const baseCompleta =
                  ind.activo_corriente != null &&
                  ind.pasivo_corriente != null &&
                  ind.activo_total != null &&
                  ind.pasivo_total != null &&
                  ind.utilidad_operacional != null;
                return (
                <tr key={ind.id}>
                  <td className="py-2 pr-4 font-medium text-slate-800">{ind.periodo}</td>
                  <td className="py-2 pr-4 text-slate-600">{formatCOP(ind.patrimonio)}</td>
                  <td className="py-2 pr-4 text-slate-600">{formatCOP(ind.capital_trabajo)}</td>
                  <td className="py-2 pr-4 text-slate-600">{ind.indice_liquidez ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-600">
                    {ind.indice_endeudamiento != null ? `${ind.indice_endeudamiento}%` : "—"}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">
                    {ind.rentabilidad_patrimonio != null ? `${ind.rentabilidad_patrimonio}%` : "—"}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">
                    {ind.rentabilidad_activo != null ? `${ind.rentabilidad_activo}%` : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        baseCompleta ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                      title="Activo/pasivo corriente y total, utilidad operacional"
                    >
                      {baseCompleta ? "Completa" : "Incompleta"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => handleEliminar(ind.id)}
                      disabled={isPending}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  step,
  inputRef,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  step?: string;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        ref={inputRef}
        name={name}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}
