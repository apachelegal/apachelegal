"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Upload, Download, Trash2, Loader2 } from "lucide-react";
import { uploadEmpresaDocumento, eliminarEmpresaDocumento, getEmpresaDocumentoUrl } from "./documentos-actions";
import { TIPO_EMPRESA_DOCUMENTO_LABELS, type EmpresaDocumento, type TipoEmpresaDocumento } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/format";

export function EmpresaDocumentosSection({
  empresaId,
  documentos,
}: {
  empresaId: string;
  documentos: EmpresaDocumento[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleUpload(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await uploadEmpresaDocumento(empresaId, formData);
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al subir el documento");
      }
    });
  }

  function handleDelete(doc: EmpresaDocumento) {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await eliminarEmpresaDocumento(empresaId, doc.id, doc.storage_path);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al eliminar el documento");
      }
    });
  }

  async function handleDownload(doc: EmpresaDocumento) {
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
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 flex items-center gap-2 font-medium text-slate-900">
        <FileText size={18} className="text-blue-600" />
        Documentos de la empresa
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
          <label className="text-xs font-medium text-slate-600">Tipo</label>
          <select
            name="tipo"
            defaultValue="rup"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            {Object.entries(TIPO_EMPRESA_DOCUMENTO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          Subir documento
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {documentos.length === 0 ? (
        <p className="text-sm text-slate-400">
          Sube el RUP, el certificado de Cámara de Comercio y los estados financieros de la
          empresa para tenerlos a la mano al armar propuestas.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {documentos.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText size={20} className="shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{doc.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {TIPO_EMPRESA_DOCUMENTO_LABELS[doc.tipo as TipoEmpresaDocumento]} ·{" "}
                    {formatBytes(doc.tamano_bytes)} · {formatDate(doc.created_at.slice(0, 10))}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => handleDownload(doc)}
                  disabled={downloadingId === doc.id}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"
                  aria-label="Descargar"
                >
                  {downloadingId === doc.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(doc)}
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
