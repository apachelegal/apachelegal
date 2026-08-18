"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Upload, Download, Trash2, Loader2 } from "lucide-react";
import { uploadManual, eliminarManual, getManualUrl } from "../actions";
import type { ManualContratacion } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/format";

export function ManualesSection({
  entidadId,
  manuales,
}: {
  entidadId: string;
  manuales: ManualContratacion[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleUpload(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await uploadManual(entidadId, formData);
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al subir el manual");
      }
    });
  }

  function handleDelete(manual: ManualContratacion) {
    if (!confirm(`¿Eliminar "${manual.nombre}"?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await eliminarManual(entidadId, manual.id, manual.storage_path);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al eliminar el manual");
      }
    });
  }

  async function handleDownload(manual: ManualContratacion) {
    setDownloadingId(manual.id);
    try {
      const url = await getManualUrl(manual.storage_path);
      window.open(url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el enlace de descarga");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 flex items-center gap-2 font-medium text-slate-900">
        <FileText size={18} className="text-blue-600" />
        Manuales de contratación
      </h2>

      <form
        ref={formRef}
        action={handleUpload}
        className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Archivo</label>
          <input
            type="file"
            name="file"
            required
            className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Vigencia</label>
          <input
            name="vigencia"
            placeholder="Ej. 2024"
            className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          Subir manual
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {manuales.length === 0 ? (
        <p className="text-sm text-slate-400">
          Sube el manual de contratación de esta entidad (en PDF) para que se use automáticamente
          al analizar sus licitaciones con IA.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {manuales.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText size={20} className="shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{m.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {m.vigencia && `Vigencia ${m.vigencia} · `}
                    {formatBytes(m.tamano_bytes)} · {formatDate(m.created_at.slice(0, 10))}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => handleDownload(m)}
                  disabled={downloadingId === m.id}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"
                  aria-label="Descargar"
                >
                  {downloadingId === m.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(m)}
                  disabled={isPending}
                  className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
