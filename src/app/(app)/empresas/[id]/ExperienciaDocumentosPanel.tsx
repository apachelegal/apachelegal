"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Upload, Download, Trash2, Loader2 } from "lucide-react";
import {
  uploadExperienciaDocumento,
  eliminarExperienciaDocumento,
  getEmpresaDocumentoUrl,
} from "./documentos-actions";
import type { ExperienciaDocumento } from "@/lib/types";
import { formatBytes } from "@/lib/format";

export function ExperienciaDocumentosPanel({
  empresaId,
  experienciaId,
  documentos,
}: {
  empresaId: string;
  experienciaId: string;
  documentos: ExperienciaDocumento[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
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
        <ul className="space-y-1">
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
    </div>
  );
}
