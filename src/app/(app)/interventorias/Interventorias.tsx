"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { FileText, FolderOpen, ExternalLink } from "lucide-react";
import type { ContratoInterventoria } from "@/lib/interventorias/datos";
import { ETIQUETAS } from "@/lib/interventorias/etiquetas";
import { alternarEtiqueta, clasificarContrato, urlDocumentoInterventoria } from "./actions";

const n0 = (n: number | null) => (n == null ? "—" : n.toLocaleString("es-CO", { maximumFractionDigits: 0 }));
const anio = (f: string | null) => (f ? f.slice(0, 4) : "s/f");

type Tipo = "todos" | "interventoria" | "consultoria";

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        activo ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export function Interventorias({ contratos }: { contratos: ContratoInterventoria[] }) {
  const [tipo, setTipo] = useState<Tipo>("interventoria");
  const [soloEaab, setSoloEaab] = useState(false);
  const [soloDocs, setSoloDocs] = useState(false);
  const [empresa, setEmpresa] = useState("");
  const [verTodas, setVerTodas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const empresas = useMemo(() => [...new Map(contratos.map((c) => [c.empresaId, c.empresa])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [contratos]);

  const lista = contratos.filter(
    (c) => (tipo === "todos" || c.tipo === tipo) && (!soloEaab || c.eaab) && (!soloDocs || c.documentos.length > 0) && (!empresa || c.empresaId === empresa),
  );

  const carpetas = useMemo(() => {
    const m = new Map<string, { id: string; nombre: string; grupo: boolean; items: ContratoInterventoria[] }>();
    for (const c of lista) {
      const f = m.get(c.empresaId) ?? { id: c.empresaId, nombre: c.empresa, grupo: c.grupo, items: [] };
      f.items.push(c);
      m.set(c.empresaId, f);
    }
    return [...m.values()];
  }, [lista]);

  const totalAporte = lista.reduce((s, c) => s + (c.aporte ?? 0), 0);
  const conDocs = lista.filter((c) => c.documentos.length > 0).length;
  const deEaab = lista.filter((c) => c.eaab).length;

  const abrir = (path: string) =>
    empezar(async () => {
      try {
        setError(null);
        window.open(await urlDocumentoInterventoria(path), "_blank");
      } catch (e) {
        setError((e as Error).message);
      }
    });

  const etiquetar = (id: string, etiqueta: string) =>
    empezar(async () => {
      try {
        setError(null);
        await alternarEtiqueta(id, etiqueta);
      } catch (e) {
        setError((e as Error).message);
      }
    });

  const clasificar = (id: string, t: "interventoria" | "consultoria" | "obra") =>
    empezar(async () => {
      try {
        setError(null);
        await clasificarContrato(id, t);
      } catch (e) {
        setError((e as Error).message);
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { t: "Contratos", v: String(lista.length) },
          { t: "Con certificado cargado", v: `${conDocs} de ${lista.length}` },
          { t: "Con la EAAB", v: String(deEaab) },
          { t: "SMMLV acreditable (× participación)", v: n0(totalAporte) },
        ].map((k) => (
          <div key={k.t} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{k.t}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{k.v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip activo={tipo === "interventoria"} onClick={() => setTipo("interventoria")}>Interventoría</Chip>
        <Chip activo={tipo === "consultoria"} onClick={() => setTipo("consultoria")}>Consultoría</Chip>
        <Chip activo={tipo === "todos"} onClick={() => setTipo("todos")}>Ambas</Chip>
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <Chip activo={soloEaab} onClick={() => setSoloEaab(!soloEaab)}>Solo EAAB</Chip>
        <Chip activo={soloDocs} onClick={() => setSoloDocs(!soloDocs)}>Solo con certificado</Chip>
        <Chip activo={verTodas} onClick={() => setVerTodas(!verTodas)}>Editar todas las etiquetas</Chip>
        <select
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
        >
          <option value="">Todas las empresas</option>
          {empresas.map(([id, nombre]) => (
            <option key={id} value={id}>{nombre}</option>
          ))}
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {carpetas.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No hay contratos con estos filtros.</p>}

      {carpetas.map((f) => (
        <section key={f.id} className="rounded-xl border border-slate-200 bg-white">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FolderOpen size={16} className="text-blue-600" />
              {f.nombre}
              {f.grupo && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">grupo</span>}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>{f.items.length} contratos · {n0(f.items.reduce((s, c) => s + (c.aporte ?? 0), 0))} SMMLV</span>
              <Link href={`/empresas/${f.id}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                Cargar certificados <ExternalLink size={12} />
              </Link>
            </div>
          </header>
          <ul className="divide-y divide-slate-100">
            {f.items.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900">{c.objeto}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.entidad || "Sin entidad"} · {anio(c.fecha)}
                    {c.numero ? ` · ${c.numero}` : ""}
                    {c.consecutivoRup ? ` · RUP #${c.consecutivoRup}` : " · sin RUP"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${c.tipo === "interventoria" ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-700"}`}>
                      {c.tipo === "interventoria" ? "Interventoría" : "Consultoría"}
                      {c.manual ? " (marcado a mano)" : ""}
                    </span>
                    {c.deSocio && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">aportado por un socio: no cuenta</span>}
                    {c.eaab && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">EAAB</span>}
                    {c.documentos.length === 0 && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">sin certificado</span>}
                    {c.documentos.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        disabled={pendiente}
                        onClick={() => abrir(d.storagePath)}
                        title={d.nombre}
                        className="inline-flex max-w-[16rem] items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-blue-700 hover:bg-blue-50"
                      >
                        <FileText size={11} />
                        <span className="truncate">{d.nombre}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ETIQUETAS.map((t) => {
                      const confirmada = c.etiquetas.includes(t.id);
                      const sugerida = !confirmada && c.sugeridas.includes(t.id);
                      if (!confirmada && !sugerida && !verTodas) return null;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={pendiente}
                          onClick={() => etiquetar(c.id, t.id)}
                          title={confirmada ? "Confirmada: clic para quitarla" : sugerida ? "Sugerida por el objeto: clic para confirmarla" : "Clic para marcarla"}
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${
                            confirmada
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : sugerida
                                ? "border-dashed border-slate-400 bg-white text-slate-600 hover:bg-slate-50"
                                : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"
                          }`}
                        >
                          {confirmada ? "✓ " : ""}{t.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex shrink-0 items-start gap-4 sm:text-right">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{n0(c.aporte)} <span className="text-xs font-normal text-slate-500">SMMLV</span></p>
                    <p className="text-xs text-slate-500">
                      {c.participacion != null ? `${c.participacion}% de ${n0(c.smmlv)}` : `participación sin cargar · ${n0(c.smmlv)}`}
                    </p>
                  </div>
                  <select
                    aria-label="Clasificación"
                    disabled={pendiente}
                    value={c.tipo}
                    onChange={(e) => clasificar(c.id, e.target.value as "interventoria" | "consultoria" | "obra")}
                    className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600"
                  >
                    <option value="interventoria">Interventoría</option>
                    <option value="consultoria">Consultoría</option>
                    <option value="obra">No: es una obra</option>
                  </select>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
