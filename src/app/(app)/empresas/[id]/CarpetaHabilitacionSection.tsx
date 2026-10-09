"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Download,
  FileText,
  FolderCheck,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  actualizarEmpresaDocumento,
  eliminarEmpresaDocumento,
  getEmpresaDocumentoUrl,
  uploadEmpresaDocumento,
} from "./documentos-actions";
import {
  TIPO_EMPRESA_DOCUMENTO_LABELS,
  type EmpresaDocumento,
  type TipoEmpresaDocumento,
  type TipoPersona,
} from "@/lib/types";
import { esItemBase, type EstadoCarpeta, type EstadoItem, type ItemEvaluado } from "@/lib/habilitacion/checklist";
import { formatBytes, formatDate } from "@/lib/format";

const BADGE: Record<EstadoItem, { texto: string; clase: string }> = {
  ok: { texto: "Listo", clase: "bg-emerald-50 text-emerald-700" },
  por_vencer: { texto: "Por vencer", clase: "bg-amber-50 text-amber-700" },
  vencido: { texto: "Vencido", clase: "bg-red-50 text-red-700" },
  falta: { texto: "Falta", clase: "bg-red-50 text-red-700" },
  verificar: { texto: "Falta una fecha", clase: "bg-amber-50 text-amber-700" },
  por_proceso_cargado: { texto: "Por proceso", clase: "bg-blue-50 text-blue-700" },
  por_proceso_falta: { texto: "Por proceso", clase: "bg-slate-100 text-slate-600" },
};

function Porcentaje({ etiqueta, valor, detalle }: { etiqueta: string; valor: number | null; detalle?: string }) {
  const color =
    valor == null ? "text-slate-400" : valor >= 100 ? "text-emerald-600" : valor >= 50 ? "text-amber-600" : "text-red-600";
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{etiqueta}</p>
      <p className={`text-2xl font-semibold ${color}`}>{valor == null ? "—" : `${valor}%`}</p>
      {detalle && <p className="text-xs text-slate-400">{detalle}</p>}
    </div>
  );
}

function DocRow({
  empresaId,
  doc,
  onError,
}: {
  empresaId: string;
  doc: EmpresaDocumento;
  onError: (mensaje: string | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [tipo, setTipo] = useState<TipoEmpresaDocumento>(doc.tipo);
  const [expedicion, setExpedicion] = useState(doc.fecha_expedicion ?? "");
  const [vencimiento, setVencimiento] = useState(doc.fecha_vencimiento ?? "");
  const [isPending, startTransition] = useTransition();
  const [descargando, setDescargando] = useState(false);

  function guardar() {
    onError(null);
    startTransition(async () => {
      try {
        await actualizarEmpresaDocumento(empresaId, doc.id, {
          tipo,
          fechaExpedicion: expedicion || null,
          fechaVencimiento: vencimiento || null,
        });
        setEditando(false);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  function eliminar() {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return;
    onError(null);
    startTransition(async () => {
      try {
        await eliminarEmpresaDocumento(empresaId, doc.id, doc.storage_path);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Error al eliminar el documento");
      }
    });
  }

  async function descargar() {
    setDescargando(true);
    try {
      window.open(await getEmpresaDocumentoUrl(doc.storage_path), "_blank");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al generar el enlace de descarga");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText size={16} className="shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="truncate text-sm text-slate-800">{doc.nombre}</p>
            <p className="text-xs text-slate-400">
              {formatBytes(doc.tamano_bytes)} · subido el {formatDate(doc.created_at.slice(0, 10))}
              {doc.fecha_expedicion && <> · expedido el {formatDate(doc.fecha_expedicion)}</>}
              {doc.fecha_vencimiento && <> · vence el {formatDate(doc.fecha_vencimiento)}</>}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            onClick={descargar}
            disabled={descargando}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"
            aria-label="Descargar"
          >
            {descargando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          </button>
          <button
            onClick={() => setEditando((v) => !v)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
            aria-label="Editar tipo y fechas"
          >
            {editando ? <X size={15} /> : <Pencil size={15} />}
          </button>
          <button
            onClick={eliminar}
            disabled={isPending}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            aria-label="Eliminar"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {editando && (
        <div className="mt-2 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Tipo
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoEmpresaDocumento)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
            >
              {Object.entries(TIPO_EMPRESA_DOCUMENTO_LABELS).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Fecha de expedición
            <input
              type="date"
              value={expedicion}
              onChange={(e) => setExpedicion(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Fecha de vencimiento
            <input
              type="date"
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
            />
          </label>
          <button
            onClick={guardar}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Guardar
          </button>
        </div>
      )}
    </li>
  );
}

function SubirInline({
  empresaId,
  tipo,
  pideVencimiento,
  onError,
}: {
  empresaId: string;
  tipo: TipoEmpresaDocumento;
  pideVencimiento: boolean;
  onError: (mensaje: string | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();

  function subir(formData: FormData) {
    onError(null);
    startTransition(async () => {
      try {
        await uploadEmpresaDocumento(empresaId, formData);
        setAbierto(false);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Error al subir el documento");
      }
    });
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <Upload size={13} />
        Subir
      </button>
    );
  }

  return (
    <form action={subir} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 p-3">
      <input type="hidden" name="tipo" value={tipo} />
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Archivo
        <input
          type="file"
          name="file"
          required
          className="text-sm font-normal text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Fecha de expedición
        <input type="date" name="fecha_expedicion" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal" />
      </label>
      {pideVencimiento && (
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Fecha de vencimiento
          <input type="date" name="fecha_vencimiento" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal" />
        </label>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        Subir
      </button>
      <button type="button" onClick={() => setAbierto(false)} className="px-2 py-1.5 text-sm text-slate-500 hover:text-slate-700">
        Cancelar
      </button>
    </form>
  );
}

function ItemRow({
  empresaId,
  item,
  onError,
}: {
  empresaId: string;
  item: ItemEvaluado;
  onError: (mensaje: string | null) => void;
}) {
  const badge = BADGE[item.estado];
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-900">{item.def.label}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.clase}`}>{badge.texto}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{item.def.ayuda}</p>
          <p className="mt-1 text-xs font-medium text-slate-700">{item.detalle}</p>
        </div>
        <SubirInline
          empresaId={empresaId}
          tipo={item.def.tipo}
          pideVencimiento={item.def.vigencia.tipo === "fecha_vencimiento"}
          onError={onError}
        />
      </div>
      {item.documentos.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
          {item.documentos.map((d) => (
            <DocRow key={d.id} empresaId={empresaId} doc={d} onError={onError} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function CarpetaHabilitacionSection({
  empresaId,
  tipoPersona,
  estado,
}: {
  empresaId: string;
  tipoPersona: TipoPersona;
  estado: EstadoCarpeta;
}) {
  const [error, setError] = useState<string | null>(null);
  const { items, tecnica, otros, porcentajes, alertas, cierre } = estado;

  const juridicaBase = items.filter((i) => i.def.carpeta === "juridica" && esItemBase(i.def));
  const juridicaProceso = items.filter((i) => i.def.carpeta === "juridica" && !esItemBase(i.def));
  const financiera = items.filter((i) => i.def.carpeta === "financiera");

  return (
    <div id="carpeta" className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-medium text-slate-900">
            <FolderCheck size={18} className="text-blue-600" />
            Carpeta de habilitación
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {tipoPersona === "natural" ? "Persona natural" : "Persona jurídica"} · lista basada en el pliego real
            EAAB ICSM-1767-2025.
          </p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1">
              <CalendarClock size={12} /> Cierre de referencia
            </span>
            <input
              type="date"
              name="cierre"
              defaultValue={cierre}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
            />
          </label>
          <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Aplicar
          </button>
        </form>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Porcentaje etiqueta="Jurídica" valor={porcentajes.juridica} />
        <Porcentaje etiqueta="Financiera" valor={porcentajes.financiera} />
        <Porcentaje
          etiqueta="Técnica"
          valor={porcentajes.tecnica}
          detalle={`${tecnica.conCertificado} de ${tecnica.totalContratos} contratos con certificado`}
        />
        <Porcentaje etiqueta="Total" valor={porcentajes.global} />
      </div>

      {alertas.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="mb-1 flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle size={15} /> Por resolver antes del cierre
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-900">
            {alertas.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <h3 className="mb-2 mt-2 text-sm font-semibold text-slate-800">Jurídica</h3>
      <div className="space-y-2">
        {juridicaBase.map((i) => (
          <ItemRow key={i.def.tipo} empresaId={empresaId} item={i} onError={setError} />
        ))}
      </div>
      <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
        Se preparan para cada licitación
      </p>
      <div className="space-y-2">
        {juridicaProceso.map((i) => (
          <ItemRow key={i.def.tipo} empresaId={empresaId} item={i} onError={setError} />
        ))}
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-800">Financiera</h3>
      <div className="space-y-2">
        {financiera.map((i) => (
          <ItemRow key={i.def.tipo} empresaId={empresaId} item={i} onError={setError} />
        ))}
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-800">Técnica</h3>
      <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
        <p>
          <span className="font-medium">{tecnica.conCertificado}</span> de{" "}
          <span className="font-medium">{tecnica.totalContratos}</span> contratos terminados tienen el certificado
          cargado
          {tecnica.sinCertificado > 0 && <> ({tecnica.sinCertificado} sin certificado)</>}. La EAAB solo acepta
          experiencia de contratos terminados, con certificado del contratante o acta de recibo, y no acepta la de
          socios ni accionistas.
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate-500">
          {tecnica.titularNoCoincide > 0 && (
            <li className="text-red-600">
              {tecnica.titularNoCoincide} contrato(s) donde el certificado no nombra a esta empresa: no sirven como
              experiencia.
            </li>
          )}
          {tecnica.titularSinVerificar > 0 && (
            <li>{tecnica.titularSinVerificar} contrato(s) con certificado cuyo titular aún no se ha verificado.</li>
          )}
          {tecnica.enEjecucion > 0 && (
            <li>
              {tecnica.enEjecucion} contrato(s) en ejecución registrados (no cuentan como experiencia
              {tecnica.enEjecucionEaab > 0 && <>; {tecnica.enEjecucionEaab} son con la EAAB (con 4 o más, la EAAB rechaza)</>}
              ).
            </li>
          )}
        </ul>
        <p className="mt-2 text-xs text-slate-400">Los certificados se cargan en la sección Experiencia de esta ficha.</p>
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-800">Otros documentos</h3>
      {otros.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
          {otros.map((d) => (
            <DocRow key={d.id} empresaId={empresaId} doc={d} onError={setError} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">No hay documentos sin clasificar.</p>
      )}
      <div className="mt-2">
        <SubirInline empresaId={empresaId} tipo="otro" pideVencimiento onError={setError} />
      </div>
    </div>
  );
}
