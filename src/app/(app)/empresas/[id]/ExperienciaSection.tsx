"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Briefcase, ChevronDown, ChevronUp, Loader2, Paperclip, Plus, Search, Trash2 } from "lucide-react";
import { crearExperiencia, eliminarExperiencia } from "../actions";
import { ESTADO_EXPERIENCIA_LABELS, type Experiencia, type ExperienciaDocumento } from "@/lib/types";
import { formatCOP, formatDate } from "@/lib/format";
import { ExperienciaDocumentosPanel } from "./ExperienciaDocumentosPanel";

export function ExperienciaSection({
  empresaId,
  experiencia,
  documentosPorExperiencia,
}: {
  empresaId: string;
  experiencia: Experiencia[];
  documentosPorExperiencia: Record<string, ExperienciaDocumento[]>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleCrear(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await crearExperiencia(empresaId, formData);
        formRef.current?.reset();
        setMostrarFormulario(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al crear el registro");
      }
    });
  }

  function handleEliminar(exp: Experiencia) {
    if (!confirm(`¿Eliminar el contrato con ${exp.entidad_contratante}?`)) return;
    startTransition(() => eliminarExperiencia(empresaId, exp.id));
  }

  const filtrada = useMemo(() => {
    const ordenada = [...experiencia].sort((a, b) =>
      (b.fecha_terminacion ?? b.fecha_inicio ?? "").localeCompare(
        a.fecha_terminacion ?? a.fecha_inicio ?? "",
      ),
    );
    if (!busqueda.trim()) return ordenada;
    const q = busqueda.toLowerCase();
    return ordenada.filter(
      (e) =>
        e.entidad_contratante.toLowerCase().includes(q) ||
        e.objeto.toLowerCase().includes(q) ||
        e.sector?.toLowerCase().includes(q),
    );
  }, [experiencia, busqueda]);

  const valorTotal = experiencia.reduce((sum, e) => sum + (e.valor ?? 0), 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <Briefcase size={18} className="text-blue-600" />
          Experiencia ({experiencia.length} contratos · {formatCOP(valorTotal)})
        </h2>
        <button
          onClick={() => setMostrarFormulario((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
        >
          <Plus size={14} />
          Añadir contrato
          {mostrarFormulario ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {mostrarFormulario && (
        <form
          ref={formRef}
          action={handleCrear}
          className="mb-5 flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Entidad contratante" name="entidad_contratante" required />
            <Field label="Número de contrato" name="numero_contrato" />
          </div>
          <Field label="Objeto" name="objeto" as="textarea" required />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Sector" name="sector" />
            <Field label="Valor (COP)" name="valor" type="number" />
            <Field label="Valor (SMMLV)" name="valor_smmlv" type="number" />
            <Field label="Participación (%)" name="participacion_pct" type="number" placeholder="100" />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Estado</label>
              <select
                name="estado"
                defaultValue="ejecutado"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                {Object.entries(ESTADO_EXPERIENCIA_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Fecha de inicio" name="fecha_inicio" type="date" />
            <Field label="Fecha de terminación" name="fecha_terminacion" type="date" />
            <Field label="Código UNSPSC (RUP)" name="codigo_unspsc" placeholder="81101500" />
            <Field label="Consecutivo RUP" name="consecutivo_rup" />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Guardar contrato
          </button>
        </form>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-500">
        <Search size={14} />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por entidad, objeto o sector..."
          className="w-full bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
        />
      </div>

      {filtrada.length === 0 ? (
        <p className="text-sm text-slate-400">No hay contratos que coincidan.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtrada.map((exp) => {
            const docs = documentosPorExperiencia[exp.id] ?? [];
            const abierto = expandido === exp.id;
            return (
              <li key={exp.id} className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-800">{exp.entidad_contratante}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {ESTADO_EXPERIENCIA_LABELS[exp.estado]}
                      </span>
                      {exp.sector && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          {exp.sector}
                        </span>
                      )}
                      {Array.isArray((exp.detalles as { actividades?: unknown[] } | null)?.actividades) &&
                        ((exp.detalles as { actividades: unknown[] }).actividades.length > 0) && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                            {(exp.detalles as { actividades: unknown[] }).actividades.length} cantidades certificadas
                          </span>
                        )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{exp.objeto}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDate(exp.fecha_inicio)} – {formatDate(exp.fecha_terminacion)}
                      {exp.participacion_pct != null && exp.participacion_pct !== 100 && (
                        <> · Participación {exp.participacion_pct}%</>
                      )}
                      {exp.numero_contrato && <> · Contrato {exp.numero_contrato}</>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <p className="text-right text-sm font-medium text-slate-800">
                      {formatCOP(exp.valor)}
                    </p>
                    <button
                      onClick={() => setExpandido(abierto ? null : exp.id)}
                      className={`flex items-center gap-1 rounded-lg p-1.5 text-xs font-medium ${
                        docs.length > 0
                          ? "text-blue-600 hover:bg-blue-50"
                          : "text-slate-400 hover:bg-slate-100"
                      }`}
                      aria-label="Certificados"
                    >
                      <Paperclip size={14} />
                      {docs.length > 0 && docs.length}
                    </button>
                    <button
                      onClick={() => handleEliminar(exp)}
                      disabled={isPending}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {abierto && (
                  <ExperienciaDocumentosPanel
                    empresaId={empresaId}
                    experienciaId={exp.id}
                    documentos={docs}
                    detalles={exp.detalles}
                  />
                )}
              </li>
            );
          })}
        </ul>
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
  as,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  as?: "textarea";
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {as === "textarea" ? (
        <textarea
          name={name}
          required={required}
          placeholder={placeholder}
          rows={2}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      )}
    </div>
  );
}
