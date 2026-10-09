"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import type { ContratoInterventoria } from "@/lib/interventorias/datos";
import { ETIQUETAS } from "@/lib/interventorias/etiquetas";
import {
  PERFILES_BASE,
  evaluarEquipoInterventoria,
  explorarEquipos,
  smmlvNecesario,
  type EquipoSugerido,
  type MiembroEquipo,
  type PerfilInterventoria,
  type ResultadoInterventoria,
} from "@/lib/interventorias/evaluador";

const n0 = (n: number) => Math.round(n).toLocaleString("es-CO");
const ESTILO = {
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
  por_confirmar: "bg-amber-50 text-amber-800 border-amber-200",
  falta: "bg-red-50 text-red-800 border-red-200",
};
const ICONO = { ok: "✓", por_confirmar: "?", falta: "✗" };
const VEREDICTO = {
  cumple: { t: "Cumple la experiencia", c: "bg-emerald-600" },
  por_confirmar: { t: "Cumple si se confirman las actividades", c: "bg-amber-600" },
  no_cumple: { t: "No cumple", c: "bg-red-600" },
};

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      {etiqueta}
      {children}
    </label>
  );
}
const input = "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900";

function Resultado({ r, nombre }: { r: ResultadoInterventoria; nombre: (id: string) => string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${VEREDICTO[r.veredicto].c}`}>{VEREDICTO[r.veredicto].t}</span>
        <span className="text-sm text-slate-600">
          {n0(r.acreditado)} SMMLV acreditados de {n0(r.necesario)} exigidos
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {r.chequeos.map((c) => (
          <li key={c.titulo} className={`rounded-lg border px-3 py-2 text-sm ${ESTILO[c.estado]}`}>
            <span className="font-medium">{ICONO[c.estado]} {c.titulo}</span>
            <span className="block text-xs opacity-90">{c.detalle}</span>
          </li>
        ))}
      </ul>
      {r.elegidos.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Contratos para el Formulario ({r.elegidos.length})</p>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {r.elegidos.map((x) => (
              <li key={x.contrato.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-slate-900">{x.contrato.objeto}</p>
                  <p className="text-xs text-slate-500">
                    {nombre(x.contrato.empresaId)} · {x.contrato.entidad} · {x.contrato.fecha?.slice(0, 4) ?? "s/f"}
                    {x.contrato.consecutivoRup ? ` · RUP #${x.contrato.consecutivoRup}` : " · sin RUP"}
                    {x.contrato.documentos.length ? " · con certificado" : " · sin certificado"}
                  </p>
                  {x.cubre.length > 0 && <p className="mt-0.5 text-xs text-emerald-700">Acredita: {x.cubre.join("; ")}</p>}
                </div>
                <p className="text-right text-sm font-medium text-slate-900">
                  {n0(x.aporte)} <span className="text-xs font-normal text-slate-500">SMMLV{x.contrato.participacion != null ? ` (${x.contrato.participacion}%)` : ""}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.avisos.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-800">
          {r.avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}
    </div>
  );
}

export function Evaluador({ contratos }: { contratos: ContratoInterventoria[] }) {
  const [perfil, setPerfil] = useState<PerfilInterventoria>(PERFILES_BASE[0]);
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [sugeridos, setSugeridos] = useState<EquipoSugerido[] | null>(null);

  const empresas = useMemo(() => {
    const m = new Map<string, string>();
    contratos.forEach((c) => m.set(c.empresaId, c.empresa));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [contratos]);
  const nombre = (id: string) => empresas.find(([i]) => i === id)?.[1] ?? "—";

  const resultado = equipo.length ? evaluarEquipoInterventoria(perfil, equipo, contratos) : null;
  const cambiar = (c: Partial<PerfilInterventoria>) => setPerfil({ ...perfil, ...c });
  const totalPct = equipo.reduce((s, m) => s + m.pct, 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Invitación</h2>
          <Campo etiqueta="Punto de partida">
            <select
              className={input}
              onChange={(e) => { setPerfil(PERFILES_BASE[Number(e.target.value)]); setSugeridos(null); }}
              defaultValue={0}
            >
              {PERFILES_BASE.map((p, i) => <option key={p.nombre} value={i}>{p.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Nombre">
            <input className={input} value={perfil.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} />
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Presupuesto oficial ($)">
              <input className={input} type="number" value={perfil.poPesos} onChange={(e) => cambiar({ poPesos: Number(e.target.value) })} />
            </Campo>
            <Campo etiqueta="SMMLV del año ($)">
              <input className={input} type="number" value={perfil.smlmv} onChange={(e) => cambiar({ smlmv: Number(e.target.value) || 1 })} />
            </Campo>
            <Campo etiqueta="% del presupuesto exigido">
              <input className={input} type="number" value={perfil.porcentajePO} onChange={(e) => cambiar({ porcentajePO: Number(e.target.value) })} />
            </Campo>
            <Campo etiqueta="Máx. de contratos">
              <input className={input} type="number" min={1} max={6} value={perfil.maxContratos} onChange={(e) => cambiar({ maxContratos: Math.max(1, Math.min(6, Number(e.target.value))) })} />
            </Campo>
            <Campo etiqueta="Ventana (años)">
              <input className={input} type="number" value={perfil.ventanaAnios} onChange={(e) => cambiar({ ventanaAnios: Number(e.target.value) })} />
            </Campo>
            <Campo etiqueta="Cierre">
              <input className={input} type="date" value={perfil.fechaCierre} onChange={(e) => cambiar({ fechaCierre: e.target.value })} />
            </Campo>
            <Campo etiqueta="Mayor aporta ≥ (% del valor)">
              <input className={input} type="number" value={perfil.mayorValorPct} onChange={(e) => cambiar({ mayorValorPct: Number(e.target.value) })} />
            </Campo>
          </div>
          <p className="text-xs text-slate-500">Valor exigido: <b>{n0(smmlvNecesario(perfil))} SMMLV</b></p>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={perfil.todosAportan} onChange={(e) => cambiar({ todosAportan: e.target.checked })} />
            Todos los integrantes deben aportar experiencia
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={perfil.aceptaConsultoria} onChange={(e) => cambiar({ aceptaConsultoria: e.target.checked })} />
            Aceptar también contratos de consultoría
          </label>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Actividades exigidas</h2>
          {perfil.criterios.map((c, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-lg border border-slate-100 p-2">
              <div className="flex gap-2">
                <select
                  className={`${input} flex-1`}
                  value={c.etiqueta}
                  onChange={(e) => cambiar({ criterios: perfil.criterios.map((x, j) => (j === i ? { ...x, etiqueta: e.target.value } : x)) })}
                >
                  {ETIQUETAS.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
                </select>
                <button type="button" aria-label="Quitar actividad" onClick={() => cambiar({ criterios: perfil.criterios.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
              <input className={input} placeholder="Texto del pliego (cantidad mínima)" value={c.texto} onChange={(e) => cambiar({ criterios: perfil.criterios.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })} />
            </div>
          ))}
          <button
            type="button"
            onClick={() => cambiar({ criterios: [...perfil.criterios, { etiqueta: ETIQUETAS[0].id, texto: ETIQUETAS[0].etiqueta }] })}
            className="inline-flex items-center gap-1 self-start text-xs font-medium text-blue-600 hover:underline"
          >
            <Plus size={14} /> Agregar actividad
          </button>
          <p className="text-xs text-slate-500">Las cantidades las comprueba una persona con el certificado; aquí cada actividad se acredita con la etiqueta del contrato.</p>
        </section>
      </div>

      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Equipo</h2>
            <button
              type="button"
              onClick={() => setSugeridos(explorarEquipos(perfil, contratos, empresas.map(([id]) => id)))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Wand2 size={14} /> Buscar el mejor equipo
            </button>
          </div>
          {equipo.map((m, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select className={`${input} min-w-0 flex-1`} value={m.empresaId} onChange={(e) => setEquipo(equipo.map((x, j) => (j === i ? { ...x, empresaId: e.target.value } : x)))}>
                {empresas.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
              <input className={`${input} w-20`} type="number" min={1} max={100} value={m.pct} onChange={(e) => setEquipo(equipo.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) } : x)))} />
              <span className="text-xs text-slate-500">%</span>
              <button type="button" aria-label="Quitar integrante" onClick={() => setEquipo(equipo.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEquipo([...equipo, { empresaId: empresas.find(([id]) => !equipo.some((m) => m.empresaId === id))?.[0] ?? empresas[0]?.[0], pct: equipo.length ? 30 : 100 }])}
              disabled={empresas.length === 0}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              <Plus size={14} /> Agregar integrante
            </button>
            {equipo.length > 1 && totalPct !== 100 && <span className="text-xs text-amber-700">Las participaciones suman {totalPct} %, no 100 %.</span>}
          </div>
        </section>

        {sugeridos && (
          <section className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Mejores equipos (solo experiencia)</h2>
            {sugeridos.length === 0 && <p className="text-sm text-slate-500">Ninguna empresa tiene contratos de interventoría utilizables.</p>}
            {sugeridos.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setEquipo(s.equipo); setSugeridos(null); }}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="text-slate-900">{s.equipo.map((m) => `${nombre(m.empresaId)}${s.equipo.length > 1 ? ` ${m.pct}%` : ""}`).join(" + ")}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium text-white ${VEREDICTO[s.resultado.veredicto].c}`}>
                  {VEREDICTO[s.resultado.veredicto].t} · {n0(s.resultado.acreditado)} SMMLV
                </span>
              </button>
            ))}
          </section>
        )}

        {resultado ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Resultado</h2>
            <Resultado r={resultado} nombre={nombre} />
          </section>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Agrega integrantes al equipo, o pulsa «Buscar el mejor equipo».</p>
        )}
      </div>
    </div>
  );
}
