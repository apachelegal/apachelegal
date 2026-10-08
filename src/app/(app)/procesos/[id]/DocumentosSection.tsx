"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { eliminarCasoDocumento, subirCasoDocumento, urlCasoDocumento } from "../actions";
import { TIPO_CASO_DOCUMENTO_LABELS, type CasoDocumento } from "@/lib/casos";
import { formatBytes, formatDate } from "@/lib/format";
import { useAccion } from "./useAccion";
import { ErrorBox } from "./FichaSection";

export function DocumentosSection({ casoId, documentos }: { casoId: string; documentos: CasoDocumento[] }) {
  const { isPending, error, run } = useAccion();
  const [descargando, setDescargando] = useState<string | null>(null);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function descargar(doc: CasoDocumento) {
    setDescargando(doc.id);
    setErrorDescarga(null);
    try {
      window.open(await urlCasoDocumento(casoId, doc.id), "_blank");
    } catch (e) {
      setErrorDescarga(e instanceof Error ? e.message : "No se pudo generar el enlace");
    } finally {
      setDescargando(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 font-medium text-slate-900">Documentos del caso</h2>

      <form
        ref={formRef}
        action={(fd) => run(() => subirCasoDocumento(casoId, fd), () => formRef.current?.reset())}
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
            defaultValue="otro"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            {Object.entries(TIPO_CASO_DOCUMENTO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
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

      {(error || errorDescarga) && <div className="mb-4"><ErrorBox message={(error ?? errorDescarga)!} /></div>}

      {documentos.length === 0 ? (
        <p className="text-sm text-slate-400">No hay documentos en este caso.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {documentos.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText size={20} className="shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{doc.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {TIPO_CASO_DOCUMENTO_LABELS[doc.tipo]} · {formatBytes(doc.tamano_bytes)} ·{" "}
                    {formatDate(doc.created_at.slice(0, 10))}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => descargar(doc)}
                  disabled={descargando === doc.id}
                  aria-label="Descargar"
                  className="rounded p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                >
                  {descargando === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                </button>
                <button
                  onClick={() => confirm(`¿Eliminar "${doc.nombre}"?`) && run(() => eliminarCasoDocumento(casoId, doc.id))}
                  disabled={isPending}
                  aria-label="Eliminar"
                  className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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
