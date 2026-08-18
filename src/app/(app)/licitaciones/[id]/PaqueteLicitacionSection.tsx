"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FolderCheck, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  actualizarChecklistItem,
  crearChecklistItem,
  eliminarChecklistItem,
  generarChecklistDesdeAnexos,
} from "./checklist-actions";
import type { ChecklistItem, Documento } from "@/lib/types";

export function PaqueteLicitacionSection({
  licitacionId,
  items,
  documentosPaquete,
  hayAnexosDetectados,
}: {
  licitacionId: string;
  items: ChecklistItem[];
  documentosPaquete: Documento[];
  hayAnexosDetectados: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleCrear(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await crearChecklistItem(licitacionId, formData);
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al crear el ítem");
      }
    });
  }

  function handleToggle(item: ChecklistItem) {
    setError(null);
    startTransition(async () => {
      try {
        await actualizarChecklistItem(licitacionId, item.id, { completado: !item.completado });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al actualizar el ítem");
      }
    });
  }

  function handleVincular(item: ChecklistItem, documentoId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await actualizarChecklistItem(licitacionId, item.id, {
          documento_id: documentoId || null,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al vincular el documento");
      }
    });
  }

  function handleEliminar(item: ChecklistItem) {
    setError(null);
    startTransition(async () => {
      try {
        await eliminarChecklistItem(licitacionId, item.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al eliminar el ítem");
      }
    });
  }

  function handleGenerar() {
    setError(null);
    startTransition(async () => {
      try {
        await generarChecklistDesdeAnexos(licitacionId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al generar el checklist");
      }
    });
  }

  const obligatorios = items.filter((i) => i.obligatorio);
  const obligatoriosCompletos = obligatorios.filter((i) => i.completado).length;
  const listoParaPresentar = obligatorios.length > 0 && obligatoriosCompletos === obligatorios.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <FolderCheck size={18} className="text-blue-600" />
          Paquete de licitación
        </h2>
        <div className="flex items-center gap-2">
          {hayAnexosDetectados && (
            <button
              onClick={handleGenerar}
              disabled={isPending}
              className="flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              <Sparkles size={14} />
              Generar desde anexos
            </button>
          )}
          <a
            href={`/licitaciones/${licitacionId}/paquete`}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
              documentosPaquete.length === 0
                ? "pointer-events-none bg-slate-100 text-slate-400"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            <Download size={14} />
            Descargar paquete (.zip)
          </a>
        </div>
      </div>

      {obligatorios.length > 0 && (
        <p className={`mb-4 text-sm ${listoParaPresentar ? "text-emerald-600" : "text-slate-500"}`}>
          {obligatoriosCompletos} de {obligatorios.length} ítems obligatorios completos
          {listoParaPresentar && " · listo para presentar"}
        </p>
      )}

      <form
        ref={formRef}
        action={handleCrear}
        className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 p-4"
      >
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Ítem del checklist</label>
          <input
            name="nombre"
            required
            placeholder="Ej. Certificado de existencia y representación legal"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 pb-1.5 text-sm text-slate-600">
          <input name="obligatorio" type="checkbox" defaultChecked className="h-4 w-4 accent-blue-600" />
          Obligatorio
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={16} />
          Añadir
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">
          No hay ítems todavía. Añade uno manualmente
          {hayAnexosDetectados && " o genera el checklist a partir de los anexos detectados por la IA"}.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <input
                  type="checkbox"
                  checked={item.completado}
                  onChange={() => handleToggle(item)}
                  disabled={isPending}
                  className="h-4 w-4 shrink-0 accent-blue-600"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className={`truncate text-sm font-medium ${
                        item.completado ? "text-slate-400 line-through" : "text-slate-800"
                      }`}
                    >
                      {item.nombre}
                    </p>
                    {item.obligatorio && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Obligatorio
                      </span>
                    )}
                  </div>
                  {item.descripcion && (
                    <p className="truncate text-xs text-slate-400">{item.descripcion}</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={item.documento_id ?? ""}
                  onChange={(e) => handleVincular(item, e.target.value)}
                  disabled={isPending}
                  className="max-w-[160px] rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Sin vincular</option>
                  {documentosPaquete.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.nombre}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleEliminar(item)}
                  disabled={isPending}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label="Eliminar ítem"
                >
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">
        El paquete descargable incluye los documentos marcados como &quot;Propuesta&quot; o &quot;Anexo&quot;
        en la sección de Documentos. Súbelo manualmente en SECOP II o Ariba — por seguridad, esta
        aplicación no inicia sesión ni presenta ofertas en esas plataformas en tu nombre.
      </p>
    </div>
  );
}
