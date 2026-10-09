import Link from "next/link";
import { Network, FlaskConical } from "lucide-react";
import { cargarControl } from "@/lib/control/datos";
import { cargarSolicitudes } from "@/lib/control/solicitudes";
import { capitalDeTrabajo, fmtM, maxParticipacion, resumenExperiencia, indicadorCompleto } from "@/lib/control/motor";
import type { EstadoRup } from "@/lib/control/tipos";
import { ControlTabs } from "./ControlTabs";

const RUP_CHIP: Record<EstadoRup, { texto: string; clase: string }> = {
  vigente: { texto: "RUP vigente", clase: "bg-emerald-50 text-emerald-700" },
  por_vencer: { texto: "RUP por vencer", clase: "bg-amber-50 text-amber-700" },
  vencido: { texto: "RUP vencido", clase: "bg-red-50 text-red-700" },
  sin_rup: { texto: "Sin RUP", clase: "bg-slate-100 text-slate-500" },
  sin_fecha: { texto: "RUP sin fecha de vencimiento", clase: "bg-slate-100 text-slate-500" },
};

const corto = (etiqueta: string) => etiqueta.split(" · ")[0];

function Barra({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="text-xs text-slate-400">—</span>;
  const color = valor >= 80 ? "bg-emerald-500" : valor >= 40 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(3, valor)}%` }} />
      </div>
      <span className="text-xs text-slate-600">{Math.round(valor)}%</span>
    </div>
  );
}

export default async function ControlPage() {
  const [datos, { solicitudes }] = await Promise.all([cargarControl(), cargarSolicitudes()]);
  const claves = datos.procesos.filter((p) => p.actividades.length > 0);

  const filas = datos.empresas.map((e) => {
    const contratos = datos.contratos.filter((c) => c.empresaId === e.id);
    const exp = resumenExperiencia(contratos, 30, datos.hoy);
    const ind = datos.indicadores[e.id];
    const r = datos.resumen[e.id];
    const alertas: { texto: string; grave?: boolean }[] = [];
    if (r.vinculadas.length) alertas.push({ texto: `Vinculada con ${r.vinculadas.join(", ")}`, grave: true });
    if (r.rupEstado === "vencido") alertas.push({ texto: `RUP vencido (${r.rupVence})`, grave: true });
    if (!ind) alertas.push({ texto: "Sin indicadores financieros", grave: true });
    else if (!indicadorCompleto(ind)) alertas.push({ texto: "Indicadores incompletos" });
    if (exp.deSocio) alertas.push({ texto: `${exp.deSocio} contratos aportados por un socio (no cuentan)`, grave: true });
    if (exp.propios && !exp.conCertificado) alertas.push({ texto: "Ningún contrato con certificado" });
    const porPedir = solicitudes.filter((x) => x.empresa_id === e.id && x.estado === "pendiente").length;
    const esperando = solicitudes.filter((x) => x.empresa_id === e.id && x.estado === "enviada").length;
    if (porPedir) alertas.push({ texto: `${porPedir} solicitudes por pedir` });
    if (esperando) alertas.push({ texto: `${esperando} solicitudes pedidas, esperando respuesta` });
    if (exp.sinFecha) alertas.push({ texto: `${exp.sinFecha} contratos sin fecha` });
    if (exp.participacionDudosa) alertas.push({ texto: `${exp.participacionDudosa} con participación por confirmar` });
    return { e, exp, ind, r, alertas };
  });

  const grupos = [
    { titulo: "Empresas del grupo", lista: filas.filter((f) => f.e.categoria === "grupo") },
    { titulo: "Posibles socios", lista: filas.filter((f) => f.e.categoria === "socio_potencial") },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Network size={24} className="text-blue-600" />
            Control de socios
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Qué puede aportar cada empresa o persona natural, con números: documentos, capacidad financiera,
            participación máxima que le permite su patrimonio en cada proceso y experiencia que realmente cuenta para
            la EAAB.
          </p>
        </div>
        <Link
          href="/control/simulador"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <FlaskConical size={16} />
          Simular un consorcio
        </Link>
      </div>

      <ControlTabs />

      {grupos.map((g) => (
        <section key={g.titulo}>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            {g.titulo} <span className="font-normal text-slate-400">· {g.lista.length}</span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Empresa</th>
                  <th className="px-3 py-2 font-medium">Habilitación</th>
                  <th className="px-3 py-2 font-medium">Financiero</th>
                  <th className="px-3 py-2 font-medium">
                    Máx. participación por patrimonio
                    <span className="block font-normal text-slate-400">{claves.map((p) => corto(p.etiqueta)).join(" · ")}</span>
                  </th>
                  <th className="px-3 py-2 font-medium">Experiencia que cuenta</th>
                  <th className="px-3 py-2 font-medium">Alertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top">
                {g.lista.map(({ e, exp, ind, r, alertas }) => (
                  <tr key={e.id}>
                    <td className="px-3 py-3">
                      <Link href={`/empresas/${e.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                        {e.nombre}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {e.nit ? `NIT ${e.nit} · ` : ""}
                        {e.tipoPersona === "natural" ? "Persona natural" : "Persona jurídica"}
                      </p>
                      <Link href={`/control/simulador?e=${e.id}`} className="text-xs text-blue-600 hover:underline">
                        Simular con esta empresa
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <Barra valor={r.habilitacion} />
                      <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] ${RUP_CHIP[r.rupEstado].clase}`}>
                        {RUP_CHIP[r.rupEstado].texto}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-700">
                      {ind ? (
                        <>
                          <p className="text-slate-400">Año {ind.periodo}</p>
                          <p>Patrimonio <b>{fmtM(ind.patrimonio)}</b></p>
                          <p>Capital de trabajo <b>{fmtM(capitalDeTrabajo(ind))}</b></p>
                        </>
                      ) : (
                        <span className="text-slate-400">Sin indicadores</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {claves.map((p) => {
                          const m = maxParticipacion(ind, p);
                          return (
                            <span
                              key={p.id}
                              title={`${p.etiqueta}: lo que su patrimonio permite frente al umbral del proceso`}
                              className={`rounded-md px-2 py-0.5 text-xs ${
                                m == null ? "bg-slate-100 text-slate-400" : m >= 99.5 ? "bg-emerald-50 text-emerald-700" : m >= 25 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                              }`}
                            >
                              {corto(p.etiqueta).replace(/^DM-/, "")}: {m == null ? "—" : `${Math.floor(m)} %`}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-700">
                      {exp.total === 0 ? (
                        <span className="text-slate-400">Sin contratos cargados</span>
                      ) : (
                        <>
                          <p>
                            <b>{exp.propios}</b> de {exp.total} contratos útiles
                          </p>
                          <p className="text-slate-500">
                            {exp.conCertificado} con certificado · {exp.conCantidades} con cantidades
                          </p>
                          {(exp.deSocio > 0 || exp.supervision > 0 || exp.ajenos > 0) && (
                            <p className="text-slate-400">
                              No cuentan: {[exp.deSocio && `${exp.deSocio} de socio`, exp.supervision && `${exp.supervision} de interventoría o consultoría`, exp.ajenos && `${exp.ajenos} de titular ajeno`].filter(Boolean).join(", ")}
                            </p>
                          )}
                          <p>
                            Mejores 4 contratos: <b>{Math.round(exp.mejores4).toLocaleString("es-CO")}</b> SMMLV
                          </p>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <ul className="flex max-w-xs flex-col gap-1">
                        {alertas.length === 0 && <li className="text-xs text-emerald-600">Sin alertas</li>}
                        {alertas.slice(0, 4).map((a) => (
                          <li key={a.texto} className={`rounded-md px-2 py-0.5 text-[11px] ${a.grave ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                            {a.texto}
                          </li>
                        ))}
                        {alertas.length > 4 && <li className="text-[11px] text-slate-400">y {alertas.length - 4} más</li>}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="text-xs text-slate-400">
        «Máx. participación» es lo que el patrimonio de la empresa le permite en cada proceso (patrimonio ÷ umbral del
        proceso); en verde alcanza el 100 %. «Experiencia que cuenta» excluye lo aportado por socios, la interventoría y
        consultoría, los contratos en ejecución, los de titular ajeno y los fuera de la ventana de recencia. Los SMMLV
        de contratos antiguos pueden estar inflados si se cargó el valor actualizado.
      </p>
    </div>
  );
}
