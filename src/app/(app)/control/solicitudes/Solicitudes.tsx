"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ClipboardCopy, Loader2, Plus, Send, Trash2, Undo2, Wand2 } from "lucide-react";
import { ESTADO_LABEL, mensajeSolicitud, type EstadoSolicitud, type SolicitudSocio } from "@/lib/control/solicitudes";
import { cambiarEstadoSolicitud, crearSolicitudManual, eliminarSolicitud, generarSolicitudes, guardarNotaSolicitud } from "./actions";

interface EmpresaLista {
  id: string;
  nombre: string;
  categoria: string;
  natural: boolean;
}

const CHIP: Record<EstadoSolicitud, string> = {
  pendiente: "bg-red-50 text-red-700",
  enviada: "bg-amber-50 text-amber-700",
  recibida: "bg-emerald-50 text-emerald-700",
  no_aplica: "bg-slate-100 text-slate-500",
};

const fechaCorta = (f: string | null) => (f ? f.slice(5).split("-").reverse().join("/") : "");

export function Solicitudes({ empresas, solicitudes }: { empresas: EmpresaLista[]; solicitudes: SolicitudSocio[] }) {
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [verTodas, setVerTodas] = useState(false);
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [nueva, setNueva] = useState({ empresa: "", titulo: "", detalle: "" });
  const [copiada, setCopiada] = useState<string | null>(null);

  const ejecutar = (fn: () => Promise<unknown>, ok?: string) =>
    iniciar(async () => {
      setAviso(null);
      try {
        await fn();
        if (ok) setAviso({ tipo: "ok", texto: ok });
      } catch (e) {
        setAviso({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo completar la acción" });
      }
    });

  const cuenta = useMemo(() => {
    const c: Record<EstadoSolicitud, number> = { pendiente: 0, enviada: 0, recibida: 0, no_aplica: 0 };
    for (const s of solicitudes) c[s.estado]++;
    return c;
  }, [solicitudes]);

  const grupos = useMemo(
    () =>
      empresas
        .filter((e) => !filtroEmpresa || e.id === filtroEmpresa)
        .map((e) => {
          const todas = solicitudes.filter((s) => s.empresa_id === e.id);
          const visibles = todas.filter((s) => verTodas || s.estado === "pendiente" || s.estado === "enviada");
          return { e, todas, visibles };
        })
        .filter((g) => g.visibles.length > 0),
    [empresas, solicitudes, filtroEmpresa, verTodas],
  );

  const copiar = async (e: EmpresaLista, items: SolicitudSocio[]) => {
    try {
      await navigator.clipboard.writeText(mensajeSolicitud(e.nombre, e.natural, items));
      setCopiada(e.id);
      setTimeout(() => setCopiada(null), 2000);
    } catch {
      setAviso({ tipo: "error", texto: "No se pudo copiar al portapapeles" });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() =>
            ejecutar(async () => {
              const r = await generarSolicitudes();
              setAviso({
                tipo: "ok",
                texto: `${r.creadas} solicitudes nuevas${r.recibidas ? ` y ${r.recibidas} marcadas como recibidas porque el documento ya está cargado` : ""}.`,
              });
            })
          }
          disabled={pendiente}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pendiente ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          Generar pendientes
        </button>
        <div className="flex gap-2 text-xs">
          {(["pendiente", "enviada", "recibida"] as const).map((k) => (
            <span key={k} className={`rounded-full px-2.5 py-1 font-medium ${CHIP[k]}`}>
              {cuenta[k]} {ESTADO_LABEL[k].toLowerCase()}
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-600">
          <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5">
            <option value="">Todas las empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} />
            Ver también recibidas y sin aplicar
          </label>
        </div>
      </div>

      {aviso && (
        <p className={`rounded-lg px-3 py-2 text-sm ${aviso.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{aviso.texto}</p>
      )}

      {grupos.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          {solicitudes.length === 0 ? "Aún no hay solicitudes. Pulsa «Generar pendientes» para armarlas." : "No hay solicitudes por atender."}
        </p>
      )}

      {grupos.map(({ e, todas, visibles }) => {
        const porPedir = todas.filter((s) => s.estado === "pendiente");
        return (
          <section key={e.id} className="rounded-xl border border-slate-200 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{e.nombre}</h2>
                <p className="text-xs text-slate-400">
                  {e.categoria === "grupo" ? "Grupo" : "Posible socio"} · {e.natural ? "Persona natural" : "Persona jurídica"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copiar(e, porPedir.length ? porPedir : visibles)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  title="Copia el mensaje con lo que falta pedirle"
                >
                  {copiada === e.id ? <Check size={14} className="text-emerald-600" /> : <ClipboardCopy size={14} />}
                  {copiada === e.id ? "Copiado" : "Copiar mensaje"}
                </button>
                {porPedir.length > 0 && (
                  <button
                    onClick={() => ejecutar(() => cambiarEstadoSolicitud(porPedir.map((s) => s.id), "enviada"))}
                    disabled={pendiente}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Send size={14} /> Marcar {porPedir.length} como pedidas
                  </button>
                )}
              </div>
            </header>
            <ul className="divide-y divide-slate-100">
              {visibles.map((s) => (
                <Fila key={s.id} s={s} bloqueado={pendiente} ejecutar={ejecutar} />
              ))}
            </ul>
          </section>
        );
      })}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Agregar una solicitud</h3>
        <div className="grid gap-2 sm:grid-cols-[220px_1fr_1fr_auto]">
          <select value={nueva.empresa} onChange={(e) => setNueva({ ...nueva, empresa: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Empresa…</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <input value={nueva.titulo} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} placeholder="Qué se le pide" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          <input value={nueva.detalle} onChange={(e) => setNueva({ ...nueva, detalle: e.target.value })} placeholder="Detalle (opcional)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          <button
            onClick={() =>
              ejecutar(async () => {
                await crearSolicitudManual(nueva.empresa, nueva.titulo, nueva.detalle);
                setNueva({ empresa: nueva.empresa, titulo: "", detalle: "" });
              })
            }
            disabled={pendiente}
            className="flex items-center justify-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            <Plus size={14} /> Agregar
          </button>
        </div>
      </section>
    </div>
  );
}

function Fila({ s, bloqueado, ejecutar }: { s: SolicitudSocio; bloqueado: boolean; ejecutar: (fn: () => Promise<unknown>, ok?: string) => void }) {
  const [nota, setNota] = useState(s.notas ?? "");
  const cambiar = (estado: EstadoSolicitud) => ejecutar(() => cambiarEstadoSolicitud([s.id], estado));
  const boton = "rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CHIP[s.estado]}`}>
            {ESTADO_LABEL[s.estado]}
            {s.estado === "enviada" && s.fecha_envio ? ` · ${fechaCorta(s.fecha_envio)}` : ""}
            {s.estado === "recibida" && s.fecha_respuesta ? ` · ${fechaCorta(s.fecha_respuesta)}` : ""}
          </span>
          <span className="text-[11px] text-slate-400">{s.tipo === "certificado" ? "Certificado" : s.tipo === "documento" ? "Documento" : "Otro"}</span>
        </div>
        <p className="mt-1 text-sm text-slate-800">{s.titulo}</p>
        {s.detalle && <p className="text-xs text-slate-500">{s.detalle}</p>}
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onBlur={() => nota.trim() !== (s.notas ?? "") && ejecutar(() => guardarNotaSolicitud(s.id, nota))}
          placeholder="Nota (a quién se le pidió, qué respondió…)"
          className="mt-1.5 w-full rounded-md border border-transparent px-1.5 py-1 text-xs text-slate-600 placeholder:text-slate-300 hover:border-slate-200 focus:border-slate-300 focus:outline-none"
        />
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {s.estado === "pendiente" && (
          <button disabled={bloqueado} onClick={() => cambiar("enviada")} className={boton}>
            Ya se pidió
          </button>
        )}
        {(s.estado === "pendiente" || s.estado === "enviada") && (
          <>
            <button disabled={bloqueado} onClick={() => cambiar("recibida")} className={boton}>
              Llegó
            </button>
            <button disabled={bloqueado} onClick={() => cambiar("no_aplica")} className={boton}>
              No aplica
            </button>
          </>
        )}
        {(s.estado === "recibida" || s.estado === "no_aplica" || s.estado === "enviada") && (
          <button disabled={bloqueado} onClick={() => cambiar("pendiente")} className={boton} title="Volver a por pedir">
            <Undo2 size={12} className="inline" />
          </button>
        )}
        <button
          disabled={bloqueado}
          onClick={() => confirm("¿Eliminar esta solicitud?") && ejecutar(() => eliminarSolicitud(s.id))}
          className="rounded-md px-1.5 py-1 text-slate-400 hover:text-red-600 disabled:opacity-50"
          title="Eliminar"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}
