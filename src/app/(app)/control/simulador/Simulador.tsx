"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleHelp, Compass, Loader2, Plus, Trash2, XCircle } from "lucide-react";
import { claveSocio, conControl, evaluarEquipo, explorarControl, fmtM, fmtN, maxIntegrantesDe, maxParticipacion, sugerirRepartos, type ExploracionControl, type RelacionControl } from "@/lib/control/motor";
import type { DatosControl, Miembro } from "@/lib/control/tipos";
import { aplicarEquipoSimulado } from "./actions";

function Estado({ ok }: { ok: boolean | null }) {
  if (ok == null) return <CircleHelp size={16} className="shrink-0 text-slate-400" />;
  return ok ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : <XCircle size={16} className="shrink-0 text-red-500" />;
}

function Insignia({ texto, tono }: { texto: string; tono: "verde" | "ambar" | "rojo" | "gris" }) {
  const clase = { verde: "bg-emerald-50 text-emerald-700", ambar: "bg-amber-50 text-amber-700", rojo: "bg-red-50 text-red-700", gris: "bg-slate-100 text-slate-500" }[tono];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${clase}`}>{texto}</span>;
}

export function Simulador({
  datos,
  procesoInicial,
  miembrosIniciales,
}: {
  datos: DatosControl;
  procesoInicial: string;
  miembrosIniciales: Miembro[];
}) {
  const [procesoId, setProcesoId] = useState(procesoInicial);
  const [miembros, setMiembros] = useState<Miembro[]>(miembrosIniciales);
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const proceso = datos.procesos.find((p) => p.id === procesoId)!;
  const nombre = (id: string) => datos.empresas.find((e) => e.id === id)?.nombre ?? "Empresa";
  const maxInt = maxIntegrantesDe(proceso);
  const usados = new Set(miembros.map((m) => m.empresaId));
  const completos = miembros.filter((m) => m.empresaId);

  const [relaciones, setRelaciones] = useState<RelacionControl[]>([]);
  const [sociosValidos, setSociosValidos] = useState<string[]>([]);
  const [exploracion, setExploracion] = useState<ExploracionControl[] | null>(null);
  const relacionesValidas = relaciones.filter((r) => r.origenId && completos.some((m) => m.empresaId === r.destinoId));
  const sociosActivos = sociosValidos.filter((k) => completos.some((m) => k.startsWith(`${m.empresaId}|`)) || relacionesValidas.some((r) => k.startsWith(`${r.origenId}|`)));
  const escenario = useMemo(() => conControl(datos, relacionesValidas, completos, sociosActivos), [datos, relacionesValidas, completos, sociosActivos]);
  // Contratos aportados por socios de cada integrante, agrupados por aportante
  const gruposSocios = useMemo(() => {
    const mapa = new Map<string, { empresaId: string; aportante: string | null; n: number; smmlv: number }>();
    const fuentes = [...new Set([...completos.map((m) => m.empresaId), ...relacionesValidas.map((r) => r.origenId)])];
    for (const empresaId of fuentes) {
      for (const c of datos.contratos.filter((x) => x.empresaId === empresaId && x.aportadaPorSocio)) {
        const k = claveSocio(c.empresaId, c.aportante);
        const g = mapa.get(k) ?? { empresaId: c.empresaId, aportante: c.aportante ?? null, n: 0, smmlv: 0 };
        g.n++;
        g.smmlv += c.smmlv ?? 0;
        mapa.set(k, g);
      }
    }
    return [...mapa].map(([clave, g]) => ({ clave, ...g }));
  }, [datos, completos, relacionesValidas]);
  const base = useMemo(() => (completos.length ? evaluarEquipo(proceso, completos, datos) : null), [proceso, completos, datos]);
  const resultado = useMemo(
    () => (completos.length ? (relacionesValidas.length || sociosActivos.length ? evaluarEquipo(proceso, completos, escenario.datos) : base) : null),
    [proceso, completos, escenario, relacionesValidas.length, sociosActivos.length, base],
  );
  const hayEscenario = relacionesValidas.length > 0 || sociosActivos.length > 0;
  const sugeridos = useMemo(
    () => (completos.length >= 2 && new Set(completos.map((m) => m.empresaId)).size === completos.length ? sugerirRepartos(proceso, completos.map((m) => m.empresaId), datos) : []),
    [proceso, completos, datos],
  );
  const suma = miembros.reduce((a, m) => a + (Number.isFinite(m.pct) ? m.pct : 0), 0);

  const cambiar = (i: number, cambio: Partial<Miembro>) => setMiembros((ms) => ms.map((m, k) => (k === i ? { ...m, ...cambio } : m)));
  const aplicar = () => {
    const actual = proceso.equipoActual.map((m) => `${nombre(m.empresaId)} ${m.pct} %`).join(", ") || "sin equipo";
    if (!confirm(`Esto reemplaza el equipo actual de la licitación (${actual}) por el del simulador. ¿Continuar?`)) return;
    setMensaje(null);
    iniciar(async () => {
      try {
        await aplicarEquipoSimulado(proceso.id, completos);
        setMensaje({ tipo: "ok", texto: "Equipo aplicado. Abre la licitación para ver la Calificación completa." });
      } catch (e) {
        setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo aplicar el equipo" });
      }
    });
  };

  const verFin = resultado?.financiero.veredicto;
  const verTec = resultado?.tecnico.veredicto;
  const reglasOk = resultado ? resultado.reglas.every((r) => r.ok !== false) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      {/* ---------------- configuración ---------------- */}
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Proceso
            <select
              value={procesoId}
              onChange={(e) => {
                setProcesoId(e.target.value);
                setMensaje(null);
              }}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-800"
            >
              {datos.procesos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500">
            <dt>Presupuesto oficial</dt>
            <dd className="text-right font-medium text-slate-800">{fmtM(proceso.presupuesto)}</dd>
            <dt>Experiencia exigida</dt>
            <dd className="text-right font-medium text-slate-800">{proceso.smmlvMin ? `${fmtN(proceso.smmlvMin)} SMMLV` : "—"}</dd>
            <dt>Contratos permitidos</dt>
            <dd className="text-right font-medium text-slate-800">máx. {proceso.maxContratos}</dd>
            <dt>Integrantes</dt>
            <dd className="text-right font-medium text-slate-800">
              máx. {maxInt} ({proceso.reglas.participacion_mayor_min_pct} % + {proceso.reglas.participacion_otros_min_pct} % c/u)
            </dd>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Integrantes</h3>
            <span className={`text-xs ${Math.abs(suma - 100) < 0.01 ? "text-emerald-600" : "text-red-600"}`}>Suman {fmtN(suma, 1)} %</span>
          </div>
          <ul className="flex flex-col gap-2">
            {miembros.map((m, i) => {
              const tope = m.empresaId ? maxParticipacion(datos.indicadores[m.empresaId], proceso) : null;
              return (
                <li key={i} className="rounded-lg border border-slate-200 p-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={m.empresaId}
                      onChange={(e) => cambiar(i, { empresaId: e.target.value })}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="">Elegir empresa…</option>
                      {datos.empresas
                        .filter((e) => e.id === m.empresaId || !usados.has(e.id))
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nombre}
                          </option>
                        ))}
                    </select>
                    <div className="flex items-center">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={Number.isFinite(m.pct) ? m.pct : ""}
                        onChange={(e) => cambiar(i, { pct: e.target.value === "" ? NaN : Number(e.target.value) })}
                        className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm"
                      />
                      <span className="ml-1 text-xs text-slate-500">%</span>
                    </div>
                    <button onClick={() => setMiembros((ms) => ms.filter((_, k) => k !== i))} className="text-slate-400 hover:text-red-600" title="Quitar">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {m.empresaId && (
                    <p className={`mt-1 text-[11px] ${tope != null && m.pct > tope + 0.01 ? "text-red-600" : "text-slate-400"}`}>
                      {tope == null ? "Sin patrimonio cargado: no se puede calcular su tope" : `Su patrimonio permite hasta ${Math.floor(tope)} % en este proceso`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setMiembros((ms) => [...ms, { empresaId: "", pct: ms.length === 0 ? 100 : proceso.reglas.participacion_otros_min_pct }])}
              disabled={miembros.length >= maxInt}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <Plus size={14} /> Agregar integrante
            </button>
            {proceso.equipoActual.length > 0 && (
              <button
                onClick={() => setMiembros(proceso.equipoActual.map((m) => ({ ...m })))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cargar el equipo actual
              </button>
            )}
          </div>

          {sugeridos.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium text-slate-600">Repartos que cumplen lo financiero (más margen primero)</p>
              <div className="flex flex-wrap gap-1.5">
                {sugeridos.map((s) => (
                  <button
                    key={s.miembros.map((m) => m.pct).join("-")}
                    onClick={() => setMiembros(s.miembros)}
                    className="rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                    title={`Capital de trabajo: sobra ${fmtM(s.margenCtn)}`}
                  >
                    {s.miembros.map((m) => m.pct).join(" / ")} · +{fmtM(s.margenCtn)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {completos.length >= 2 && sugeridos.length === 0 && (
            <p className="mt-4 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
              Ningún reparto de estas empresas cumple todos los indicadores financieros de este proceso (o falta algún
              dato financiero).
            </p>
          )}
        </div>

        {completos.length > 0 && (
          <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50/40 p-4">
            <h3 className="text-sm font-semibold text-violet-900">Escenario de control (hipótesis)</h3>
            <p className="mt-1 text-[11px] text-violet-800">
              Qué pasaría si una empresa fuera matriz, filial o subordinada de un integrante y este pudiera usar su
              experiencia. Solo vale si el control es real y está inscrito en Cámara de Comercio.
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {relaciones.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                  <select
                    value={r.origenId}
                    onChange={(e) => setRelaciones((rs) => rs.map((x, k) => (k === i ? { ...x, origenId: e.target.value } : x)))}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-1.5 py-1"
                  >
                    <option value="">Empresa que presta…</option>
                    {datos.empresas
                      .filter((e) => !usados.has(e.id))
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                  </select>
                  <span className="text-slate-500">→</span>
                  <select
                    value={r.destinoId}
                    onChange={(e) => setRelaciones((rs) => rs.map((x, k) => (k === i ? { ...x, destinoId: e.target.value } : x)))}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-1.5 py-1"
                  >
                    {completos.map((m) => (
                      <option key={m.empresaId} value={m.empresaId}>
                        {nombre(m.empresaId)}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => setRelaciones((rs) => rs.filter((_, k) => k !== i))} className="text-slate-400 hover:text-red-600" title="Quitar">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            {gruposSocios.length > 0 && (
              <div className="mt-3 rounded-lg bg-white p-2 ring-1 ring-violet-200">
                <p className="text-[11px] font-medium text-violet-900">Aceptar como válida la experiencia que el RUP atribuye a accionistas o constituyentes</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {gruposSocios.map((g) => (
                    <li key={g.clave}>
                      <label className="flex items-start gap-1.5 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={sociosValidos.includes(g.clave)}
                          onChange={(e) => setSociosValidos((ks) => (e.target.checked ? [...ks, g.clave] : ks.filter((k) => k !== g.clave)))}
                        />
                        <span>
                          <b>{g.aportante ?? "Aportante sin nombre en el RUP"}</b> en {nombre(g.empresaId)}: {g.n} contratos, {fmtN(g.smmlv)} SMMLV brutos
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[10px] text-slate-500">Los contratos sin objeto legible no cuentan hasta tener el certificado.</p>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => setRelaciones((rs) => [...rs, { origenId: "", destinoId: completos[0].empresaId }])}
                className="flex items-center gap-1 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-50"
              >
                <Plus size={14} /> Agregar relación
              </button>
              <button
                onClick={() => setExploracion(explorarControl(proceso, completos, datos))}
                className="flex items-center gap-1 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-50"
              >
                <Compass size={14} /> Explorar qué control ayudaría
              </button>
            </div>
            {exploracion && (
              <div className="mt-3">
                {exploracion.length === 0 ? (
                  <p className="text-xs text-slate-500">Ninguna otra empresa aportaría contratos útiles a este equipo.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {exploracion.map((x) => (
                      <li key={x.tipo + x.origenId + x.destinoId} className="rounded-lg bg-white p-2 text-xs ring-1 ring-slate-200">
                        <p className="text-slate-800">
                          {x.tipo === "socios" ? (
                            <>Aceptar la experiencia de socios de <b>{nombre(x.destinoId)}</b></>
                          ) : (
                            <>
                              <b>{nombre(x.origenId)}</b> → {nombre(x.destinoId)}
                            </>
                          )}
                        </p>
                        <p className="text-slate-500">
                          Actividades: {x.confirmadas} confirmadas, {x.pistas} con pista, {x.faltas} sin evidencia · {fmtN(x.capacidad)} SMMLV
                          {x.deltaCapacidad !== 0 ? ` (${x.deltaCapacidad > 0 ? "+" : ""}${fmtN(x.deltaCapacidad)})` : ""} · usaría {x.contratosUsados} contrato(s) suyos
                        </p>
                        <button
                          onClick={() =>
                            x.tipo === "socios"
                              ? setSociosValidos((ks) => [...new Set([...ks, ...(x.claves ?? [])])])
                              : setRelaciones((rs) => [...rs.filter((r) => r.origenId !== x.origenId), { origenId: x.origenId, destinoId: x.destinoId }])
                          }
                          className="mt-1 text-violet-700 underline"
                        >
                          Probar este escenario
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {completos.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <button
              onClick={aplicar}
              disabled={pendiente || Math.abs(suma - 100) > 0.01 || miembros.some((m) => !m.empresaId)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {pendiente && <Loader2 size={16} className="animate-spin" />}
              Usar este equipo en la licitación
            </button>
            <p className="mt-2 text-[11px] text-slate-400">Reemplaza el equipo de la licitación para ver la Calificación completa.</p>
            {mensaje && (
              <p className={`mt-2 text-xs ${mensaje.tipo === "ok" ? "text-emerald-700" : "text-red-600"}`}>
                {mensaje.texto}{" "}
                {mensaje.tipo === "ok" && (
                  <Link href={`/licitaciones/${proceso.id}?tab=calificacion`} className="underline">
                    Abrir Calificación
                  </Link>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ---------------- resultado ---------------- */}
      <div className="flex min-w-0 flex-col gap-4">
        {!resultado ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
            Agrega integrantes para ver si el consorcio cumple.
          </div>
        ) : (
          <>
            {hayEscenario && base && (
              <div className="rounded-xl border border-violet-300 bg-violet-50 p-4 text-sm text-violet-900">
                <p className="font-semibold">Escenario hipotético de control activo</p>
                <p className="mt-0.5 text-xs">
                  Sin el control: {base.tecnico.actividades.filter((a) => a.estado === "confirmada").length} de {base.tecnico.actividades.length} actividades
                  confirmadas y {fmtN(base.tecnico.smmlv.capacidad)} SMMLV. Con el control:{" "}
                  {resultado.tecnico.actividades.filter((a) => a.estado === "confirmada").length} de {resultado.tecnico.actividades.length} y{" "}
                  {fmtN(resultado.tecnico.smmlv.capacidad)} SMMLV. El financiero no cambia: la experiencia se presta, los indicadores no.
                </p>
                {escenario.avisos.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-amber-900">
                    {escenario.avisos.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
              <Insignia texto={reglasOk ? "Reglas del plural: cumple" : "Reglas del plural: no cumple"} tono={reglasOk ? "verde" : "rojo"} />
              <Insignia
                texto={`Financiero: ${verFin === "cumple" ? "cumple" : verFin === "no_cumple" ? "no cumple" : "faltan datos"}${resultado.financiero.margenCtn != null ? ` (capital de trabajo ${resultado.financiero.margenCtn >= 0 ? "sobra" : "falta"} ${fmtM(Math.abs(resultado.financiero.margenCtn))})` : ""}`}
                tono={verFin === "cumple" ? "verde" : verFin === "no_cumple" ? "rojo" : "gris"}
              />
              <Insignia
                texto={`Técnico: ${verTec === "confirmado" ? "confirmado con certificados" : verTec === "con_pistas" ? "solo con pistas" : "incompleto"}`}
                tono={verTec === "confirmado" ? "verde" : verTec === "con_pistas" ? "ambar" : "rojo"}
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Reglas del plural</h3>
              <ul className="space-y-1 text-sm">
                {resultado.reglas.map((r) => (
                  <li key={r.etiqueta} className="flex items-start gap-2">
                    <Estado ok={r.ok} />
                    <span className="text-slate-700">
                      {r.etiqueta} <span className="text-xs text-slate-400">· {r.detalle}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Financiero</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-xs">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="py-1 text-left font-medium">Integrante</th>
                      <th className="py-1 text-right font-medium">%</th>
                      <th className="py-1 text-right font-medium">Patrimonio</th>
                      <th className="py-1 text-right font-medium">Mínimo exigido</th>
                      <th className="py-1 text-right font-medium">Aporta al capital de trabajo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resultado.financiero.integrantes.map((i) => (
                      <tr key={i.id}>
                        <td className="py-1.5 pr-2 text-slate-800">
                          {nombre(i.id)} <span className="text-slate-400">{i.periodo ? `· ${i.periodo}` : ""}</span>
                        </td>
                        <td className="py-1.5 text-right">{fmtN(i.pct, 1)}</td>
                        <td className="py-1.5 text-right">
                          <span className="mr-1 inline-block align-middle">
                            <Estado ok={i.patrimonioOk} />
                          </span>
                          {fmtM(i.patrimonio)}
                        </td>
                        <td className="py-1.5 text-right">{fmtM(i.patrimonioMin)}</td>
                        <td className="py-1.5 text-right">{fmtM(i.ctnAporte)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <table className="mt-3 w-full text-xs">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-1 text-left font-medium">Indicador del consorcio (ponderado)</th>
                    <th className="py-1 text-right font-medium">Resultado</th>
                    <th className="py-1 text-right font-medium">Exigido</th>
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resultado.financiero.agrupados.map((a) => (
                    <tr key={a.etiqueta}>
                      <td className="py-1.5 text-slate-700">{a.etiqueta}</td>
                      <td className="py-1.5 text-right font-medium text-slate-800">{a.valor}</td>
                      <td className="py-1.5 text-right text-slate-500">{a.exigido}</td>
                      <td className="py-1.5 pl-2">
                        <Estado ok={a.ok} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Técnico: actividades exigidas</h3>
              <ul className="space-y-3">
                {resultado.tecnico.actividades.map((a) => (
                  <li key={a.numero} className="text-sm">
                    <div className="flex items-start gap-2">
                      <Insignia texto={a.estado === "confirmada" ? "Confirmada" : a.estado === "pista" ? "Solo pista" : "Falta"} tono={a.estado === "confirmada" ? "verde" : a.estado === "pista" ? "ambar" : "rojo"} />
                      <p className="text-slate-700">
                        <span className="font-medium">Actividad {a.numero}.</span> {a.descripcion}
                      </p>
                    </div>
                    <p className="ml-1 mt-1 text-xs text-slate-500">{a.detalle}</p>
                    {a.aportes.length > 0 && (
                      <ul className="ml-1 mt-1 space-y-0.5 text-xs text-slate-500">
                        {a.aportes.map((x) => (
                          <li key={x.empresaId + x.texto}>
                            · <span className="text-slate-700">{nombre(x.empresaId)}</span>: {x.texto}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
                {resultado.tecnico.actividades.length === 0 && <li className="text-xs text-slate-400">Este proceso no tiene actividades estructuradas; solo se evalúa el valor en SMMLV.</li>}
              </ul>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2 text-sm">
                  <Estado ok={resultado.tecnico.smmlv.ok} />
                  <span className="text-slate-700">
                    Valor acumulado: <b>{fmtN(resultado.tecnico.smmlv.capacidad)}</b> SMMLV
                    {resultado.tecnico.smmlv.requerido != null && <> de {fmtN(resultado.tecnico.smmlv.requerido)} exigidos</>}
                    <span className="text-xs text-slate-400"> · ponderado por participación, con los {resultado.tecnico.smmlv.contratos.length} contratos escogidos</span>
                  </span>
                </div>
                {completos.length > 1 && (
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <Estado ok={resultado.tecnico.smmlv.mayorOk} />
                    <span className="text-slate-700">
                      El integrante mayor aporta ≥ {proceso.reglas.aporte_mayor_pct_valor} % del valor exigido
                      <span className="text-xs text-slate-400"> · aporta {fmtN(resultado.tecnico.smmlv.aporteMayor)} SMMLV</span>
                    </span>
                  </div>
                )}
                <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                  {resultado.tecnico.smmlv.contratos.map((c, i) => (
                    <li key={i}>
                      · <span className="text-slate-700">{nombre(c.empresaId)}</span> — {c.entidad.slice(0, 40)}: {c.objeto} ({fmtN(c.aporte)} SMMLV)
                      {c.via && <span className="ml-1 rounded bg-violet-100 px-1.5 text-violet-700">por control, de {c.via}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {resultado.alertas.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <AlertTriangle size={16} /> Alertas
                </h3>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-900">
                  {resultado.alertas.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-slate-400">
              «Confirmada» usa las cantidades certificadas y extraídas de los contratos; «solo pista» significa que el
              objeto del contrato sugiere la actividad, pero no hay cantidades que lo demuestren. El simulador es una
              guía: la Calificación de la licitación es la evaluación completa. Los SMMLV de contratos antiguos pueden
              estar inflados si se cargó el valor actualizado.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
