"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Upload, Download, Trash2, Loader2, Sparkles, Plus, X, Save } from "lucide-react";
import {
  uploadExperienciaDocumento,
  eliminarExperienciaDocumento,
  getEmpresaDocumentoUrl,
  extraerDetallesExperienciaAction,
  guardarDetallesExperiencia,
} from "./documentos-actions";
import type { ExperienciaDocumento } from "@/lib/types";
import type { ActividadDetalle, DetallesExperienciaExtraidos } from "@/lib/ai/extraerDetallesExperiencia";
import { formatBytes } from "@/lib/format";

function detallesDesdeGuardados(detalles: Record<string, unknown> | null): DetallesExperienciaExtraidos {
  if (!detalles) return { actividades: [], notas: null };
  const actividades = Array.isArray(detalles.actividades) ? (detalles.actividades as ActividadDetalle[]) : [];
  const notas = typeof detalles.notas === "string" ? detalles.notas : null;
  return { actividades, notas };
}

export function ExperienciaDocumentosPanel({
  empresaId,
  experienciaId,
  documentos,
  detalles,
}: {
  empresaId: string;
  experienciaId: string;
  documentos: ExperienciaDocumento[];
  detalles: Record<string, unknown> | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [extrayendo, setExtrayendo] = useState(false);
  const [detallesEdit, setDetallesEdit] = useState<DetallesExperienciaExtraidos>(() =>
    detallesDesdeGuardados(detalles),
  );
  const [mostrarDetalles, setMostrarDetalles] = useState(
    () => detallesDesdeGuardados(detalles).actividades.length > 0,
  );

  const datosPreviosSinFormato = (() => {
    if (!detalles) return null;
    const { actividades: _actividades, notas: _notas, ...resto } = detalles as Record<string, unknown>;
    return Object.keys(resto).length > 0 ? resto : null;
  })();
  const formRef = useRef<HTMLFormElement>(null);

  function handleUpload(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await uploadExperienciaDocumento(empresaId, experienciaId, formData);
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al subir el certificado");
      }
    });
  }

  function handleDelete(doc: ExperienciaDocumento) {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await eliminarExperienciaDocumento(empresaId, doc.id, doc.storage_path);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al eliminar el certificado");
      }
    });
  }

  async function handleDownload(doc: ExperienciaDocumento) {
    setDownloadingId(doc.id);
    try {
      const url = await getEmpresaDocumentoUrl(doc.storage_path);
      window.open(url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el enlace de descarga");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleExtraer() {
    setError(null);
    setExtrayendo(true);
    setMostrarDetalles(true);
    try {
      const resultado = await extraerDetallesExperienciaAction(empresaId, experienciaId);
      setDetallesEdit(resultado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al extraer los detalles con IA");
    } finally {
      setExtrayendo(false);
    }
  }

  function actualizarActividad(index: number, campo: keyof ActividadDetalle, valor: string) {
    setDetallesEdit((prev) => {
      const actividades = [...prev.actividades];
      actividades[index] = {
        ...actividades[index],
        [campo]: campo === "cantidad" ? Number(valor) : valor,
      };
      return { ...prev, actividades };
    });
  }

  function agregarActividad() {
    setDetallesEdit((prev) => ({
      ...prev,
      actividades: [...prev.actividades, { descripcion: "", cantidad: 0, unidad: "" }],
    }));
  }

  function eliminarActividad(index: number) {
    setDetallesEdit((prev) => ({
      ...prev,
      actividades: prev.actividades.filter((_, i) => i !== index),
    }));
  }

  function handleGuardarDetalles() {
    setError(null);
    startTransition(async () => {
      try {
        await guardarDetallesExperiencia(empresaId, experienciaId, detallesEdit);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar los detalles");
      }
    });
  }

  return (
    <div className="mt-2 rounded-lg bg-slate-50 p-3">
      <form ref={formRef} action={handleUpload} className="mb-2 flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="file"
          required
          className="text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-200 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-300"
        />
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          Subir certificado
        </button>
      </form>

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {documentos.length === 0 ? (
        <p className="text-xs text-slate-400">Sin certificados adjuntos para este contrato.</p>
      ) : (
        <ul className="mb-3 space-y-1">
          {documentos.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-600">
                <FileText size={12} className="shrink-0 text-slate-400" />
                <span className="truncate">{doc.nombre}</span>
                <span className="shrink-0 text-slate-400">({formatBytes(doc.tamano_bytes)})</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => handleDownload(doc)}
                  disabled={downloadingId === doc.id}
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-blue-600 disabled:opacity-50"
                  aria-label="Descargar"
                >
                  {downloadingId === doc.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Download size={12} />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={isPending}
                  className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
                  aria-label="Eliminar"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-slate-200 pt-2">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-600">
            Cantidades y actividades técnicas certificadas
          </p>
          <button
            onClick={handleExtraer}
            disabled={documentos.length === 0 || extrayendo}
            className="flex items-center gap-1 rounded-md border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            title={documentos.length === 0 ? "Sube un certificado en PDF primero" : undefined}
          >
            {extrayendo ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Extraer con IA
          </button>
        </div>

        {datosPreviosSinFormato && (
          <p className="mb-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
            Este contrato ya tiene datos técnicos de una importación anterior (en otro formato), que
            se conservan aunque no se muestren aquí:{" "}
            <span className="font-mono">{JSON.stringify(datosPreviosSinFormato).slice(0, 200)}</span>
          </p>
        )}

        {!mostrarDetalles ? (
          <p className="text-xs text-slate-400">
            Sin cantidades registradas. Súbe el certificado y extrae con IA, o añade manualmente.{" "}
            <button onClick={() => setMostrarDetalles(true)} className="text-blue-600 hover:underline">
              Añadir manualmente
            </button>
          </p>
        ) : (
          <>
            {detallesEdit.actividades.length === 0 ? (
              <p className="mb-2 text-xs text-slate-400">Ninguna cantidad registrada todavía.</p>
            ) : (
              <div className="mb-2 flex flex-col gap-1.5">
                {detallesEdit.actividades.map((act, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      value={act.descripcion}
                      onChange={(e) => actualizarActividad(i, "descripcion", e.target.value)}
                      placeholder="Descripción (ej. Estación de bombeo)"
                      className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      value={act.cantidad}
                      type="number"
                      onChange={(e) => actualizarActividad(i, "cantidad", e.target.value)}
                      placeholder="Cantidad"
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      value={act.unidad}
                      onChange={(e) => actualizarActividad(i, "unidad", e.target.value)}
                      placeholder="Unidad (l/s, m3, m)"
                      className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={() => eliminarActividad(i)}
                      className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600"
                      aria-label="Quitar"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {detallesEdit.notas && (
              <p className="mb-2 rounded-md bg-blue-50 px-2 py-1.5 text-[11px] italic text-blue-700">
                {detallesEdit.notas}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={agregarActividad}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                <Plus size={12} />
                Añadir cantidad
              </button>
              <button
                onClick={handleGuardarDetalles}
                disabled={isPending}
                className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Guardar detalles
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
