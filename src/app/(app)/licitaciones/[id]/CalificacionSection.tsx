import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { cargarCalificacion, type Calificacion, type Veredicto } from "@/lib/eaab/calificacion";

const ESTILO: Record<Veredicto | "no_aplica", { texto: string; clase: string }> = {
  cumple: { texto: "CUMPLE", clase: "bg-emerald-50 text-emerald-700" },
  no_cumple: { texto: "NO CUMPLE", clase: "bg-red-50 text-red-700" },
  sin_datos: { texto: "SIN DATOS", clase: "bg-amber-50 text-amber-700" },
  no_aplica: { texto: "N/A", clase: "bg-slate-50 text-slate-400" },
};

function Sello({ v, grande }: { v: Veredicto | "no_aplica"; grande?: boolean }) {
  const e = ESTILO[v];
  const Icono = v === "cumple" ? CheckCircle2 : v === "no_cumple" ? XCircle : CircleHelp;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold ${e.clase} ${grande ? "text-sm" : "text-xs"}`}>
      {v !== "no_aplica" && <Icono size={grande ? 15 : 12} />}
      {e.texto}
    </span>
  );
}

function Bloque({ titulo, veredicto, children }: { titulo: string; veredicto?: Veredicto; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
        {veredicto && <Sello v={veredicto} />}
      </div>
      {children}
    </section>
  );
}

const num = (n: number | null, d = 2) => (n == null ? "—" : n.toLocaleString("es-CO", { maximumFractionDigits: d }));

function Resumen({ c }: { c: Calificacion }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Cuadro resumen · evaluación jurídica, técnica y financiera</h2>
          <p className="text-xs text-slate-500">
            Simulación con el formato del informe de evaluación de la EAAB. Donde falta información dice SIN DATOS; no se asume nada.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Concepto final</span>
          <Sello v={c.conceptoFinal} grande />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="py-2 pr-4 font-medium">Integrante</th>
              <th className="py-2 pr-4 font-medium">Part.</th>
              <th className="py-2 pr-4 font-medium">Jurídico</th>
              <th className="py-2 pr-4 font-medium">Técnico</th>
              <th className="py-2 pr-4 font-medium">Financiero</th>
              <th className="py-2 pr-4 text-right font-medium">Puntaje parcial</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {c.integrantes.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-slate-400">Define el equipo en la pestaña Equipo para evaluar la oferta.</td>
              </tr>
            ) : (
              c.integrantes.map((i, k) => (
                <tr key={i.nombre}>
                  <td className="py-2.5 pr-4 font-medium text-slate-900">{i.nombre}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{i.porcentaje}%</td>
                  {k === 0 ? (
                    <>
                      <td className="py-2.5 pr-4" rowSpan={c.integrantes.length}><Sello v={c.juridico.veredicto} /></td>
                      <td className="py-2.5 pr-4" rowSpan={c.integrantes.length}><Sello v={c.tecnico.veredicto} /></td>
                      <td className="py-2.5 pr-4" rowSpan={c.integrantes.length}><Sello v={c.financiero.veredicto} /></td>
                      <td className="py-2.5 pr-4 text-right" rowSpan={c.integrantes.length}>
                        <span className="text-base font-semibold text-slate-900">{c.ponderables.puntosParciales.toLocaleString("es-CO")}</span>
                        <span className="block text-xs text-slate-400">de {c.ponderables.maximo.toLocaleString("es-CO")} (sin oferta económica)</span>
                      </td>
                    </>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export async function CalificacionSection({ licitacionId }: { licitacionId: string }) {
  const c = await cargarCalificacion(licitacionId);
  if (!c) return null;
  const sinEquipo = c.integrantes.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <Resumen c={c} />

      {!sinEquipo && (
        <>
          <Bloque titulo="1. Evaluación jurídica" veredicto={c.juridico.veredicto}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-2 font-medium">Documento</th>
                    {c.integrantes.map((i) => (
                      <th key={i.nombre} className="px-3 py-2 font-medium normal-case">{i.nombre}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {c.juridico.filas.map((f) => (
                    <tr key={f.etiqueta}>
                      <td className="px-5 py-2.5 text-slate-800">
                        {f.etiqueta}
                        {f.ayuda && <span className="block text-xs text-slate-400">{f.ayuda}</span>}
                      </td>
                      {f.porIntegrante ? (
                        f.celdas.map((celda, k) => (
                          <td key={k} className="px-3 py-2.5" title={celda.detalle}>
                            <Sello v={celda.veredicto} />
                          </td>
                        ))
                      ) : (
                        <td className="px-3 py-2.5" colSpan={c.integrantes.length} title={f.celdas[0].detalle}>
                          <Sello v={f.celdas[0].veredicto} />
                          <span className="ml-2 text-xs text-slate-400">{f.celdas[0].detalle}</span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {c.juridico.reglasPlural.length > 0 && (
              <ul className="space-y-1.5 border-t border-slate-100 px-5 py-3 text-sm">
                {c.juridico.reglasPlural.map((r) => (
                  <li key={r.etiqueta} className="flex items-center justify-between gap-3">
                    <span className="text-slate-700">{r.etiqueta} <span className="text-xs text-slate-400">· {r.detalle}</span></span>
                    <Sello v={r.veredicto} />
                  </li>
                ))}
              </ul>
            )}
          </Bloque>

          <Bloque titulo="2. Evaluación técnica" veredicto={c.tecnico.veredicto}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Contratista</th>
                    <th className="px-3 py-2 font-medium">Entidad · objeto</th>
                    <th className="px-3 py-2 text-right font-medium">Valor (SMMLV)</th>
                    <th className="px-3 py-2 text-right font-medium">Part.</th>
                    <th className="px-3 py-2 text-right font-medium">Acreditado</th>
                    <th className="px-3 py-2 font-medium">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {c.tecnico.contratos.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-4 text-slate-400">No hay contratos elegidos. Selecciona la experiencia en la pestaña Equipo.</td></tr>
                  ) : (
                    c.tecnico.contratos.map((k, i) => (
                      <tr key={`${k.numeroContrato}-${i}`}>
                        <td className="px-4 py-2.5 font-medium text-slate-700">{i + 1}</td>
                        <td className="px-3 py-2.5 text-slate-800">{k.integrante}</td>
                        <td className="max-w-md px-3 py-2.5 text-slate-700">
                          <span className="font-medium">{k.entidad}</span>
                          <span className="block text-slate-500">{k.objeto.slice(0, 140)}{k.objeto.length > 140 ? "…" : ""}</span>
                          <span className="text-slate-400">{k.numeroContrato ?? "sin número"} {k.unspsc ? `· UNSPSC ${k.unspsc}` : ""}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">{num(k.valorSmmlv, 0)}</td>
                        <td className="px-3 py-2.5 text-right">{k.participacion == null ? "—" : `${num(k.participacion * 100, 1)}%`}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{num(k.acreditadoSmmlv, 0)}</td>
                        <td className="px-3 py-2.5">
                          {k.problemas.length === 0 ? <span className="text-emerald-600">Sin observaciones</span> : (
                            <ul className="list-disc space-y-0.5 pl-4 text-amber-700">{k.problemas.map((p) => <li key={p}>{p}</li>)}</ul>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {c.tecnico.actividades.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-4">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Actividades exigidas</h3>
                <ul className="space-y-3">
                  {c.tecnico.actividades.map((a) => (
                    <li key={a.numero}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-slate-800"><span className="font-medium">Actividad {a.numero}.</span> {a.descripcion}</p>
                        <Sello v={a.veredicto} />
                      </div>
                      <ul className="mt-1 space-y-0.5 pl-4 text-xs text-slate-500">
                        {a.alternativas.map((alt) => (
                          <li key={alt.texto} className={alt.cumple ? "text-emerald-700" : ""}>
                            {alt.texto}: {num(alt.acreditado, 1)} {alt.unidad} acreditados{alt.cumple ? " ✓" : ""}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="space-y-1.5 border-t border-slate-100 px-5 py-3 text-sm">
              {c.tecnico.verificaciones.map((r) => (
                <li key={r.etiqueta} className="flex items-center justify-between gap-3">
                  <span className="text-slate-700">{r.etiqueta} <span className="text-xs text-slate-400">· {r.detalle}</span></span>
                  <Sello v={r.veredicto} />
                </li>
              ))}
            </ul>
          </Bloque>

          <Bloque titulo="3. Capacidad financiera y organizacional" veredicto={c.financiero.veredicto}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Indicador</th>
                    {c.financiero.integrantes.map((i) => (
                      <th key={i.nombre} className="px-3 py-2 text-right font-medium">{i.nombre}<span className="block font-normal text-slate-400">{i.periodo ? `RUP ${i.periodo}` : "sin datos"}</span></th>
                    ))}
                    <th className="px-3 py-2 text-right font-medium">Oferente</th>
                    <th className="px-3 py-2 font-medium">Exigido</th>
                    <th className="px-3 py-2 font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {c.financiero.agrupados.map((a, idx) => {
                    const clave = ["liquidez", "endeudamiento", "cobertura", "capitalTrabajo", "patrimonio", "roe", "roa"][idx] as keyof (typeof c.financiero.integrantes)[number];
                    return (
                      <tr key={a.etiqueta}>
                        <td className="px-4 py-2.5 text-slate-800">{a.etiqueta}</td>
                        {c.financiero.integrantes.map((i) => (
                          <td key={i.nombre} className="px-3 py-2.5 text-right text-slate-600">
                            {idx === 3 || idx === 4 ? formatCOP(i[clave] as number | null) : num(i[clave] as number | null)}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right font-medium text-slate-900">{idx === 3 ? formatCOP(a.valor) : idx === 4 ? "—" : num(a.valor)}</td>
                        <td className="px-3 py-2.5 text-slate-500">{a.exigido}</td>
                        <td className="px-3 py-2.5"><Sello v={a.veredicto} /></td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="px-4 py-2.5 text-slate-800">{c.financiero.cupoCredito.etiqueta}</td>
                    <td colSpan={c.financiero.integrantes.length + 2} className="px-3 py-2.5 text-slate-500">{c.financiero.cupoCredito.detalle}</td>
                    <td className="px-3 py-2.5"><Sello v={c.financiero.cupoCredito.veredicto} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              En plurales la EAAB agrupa los indicadores ponderando por participación, y exige el patrimonio a cada integrante en proporción a su porcentaje. Los umbrales de este proyecto son una estimación tomada de procesos anteriores hasta que se publique la invitación.
            </p>
          </Bloque>

          <Bloque titulo="4. Requisitos ponderables">
            <ul className="divide-y divide-slate-100">
              {c.ponderables.items.map((p) => (
                <li key={p.etiqueta} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.etiqueta}</p>
                    <p className="text-xs text-slate-500">{p.detalle}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-900">{p.puntos == null ? "—" : p.puntos.toLocaleString("es-CO")} <span className="font-normal text-slate-400">/ {p.maximo.toLocaleString("es-CO")}</span></p>
                  </div>
                </li>
              ))}
            </ul>
          </Bloque>

          <Bloque titulo="5. Causales de rechazo a vigilar">
            <ul className="divide-y divide-slate-100">
              {c.causales.map((r) => (
                <li key={r.etiqueta} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${r.veredicto === "no_cumple" ? "text-red-500" : "text-amber-500"}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{r.etiqueta}</p>
                      <p className="text-xs text-slate-500">{r.detalle}</p>
                    </div>
                  </div>
                  <Sello v={r.veredicto === "cumple" ? "cumple" : r.veredicto} />
                </li>
              ))}
            </ul>
          </Bloque>
        </>
      )}
    </div>
  );
}
