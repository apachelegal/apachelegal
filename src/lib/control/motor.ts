import { cantidadAcreditada, textoCriterio, umbrales } from "@/lib/eaab/criterios";
import type { CriterioActividad } from "@/lib/types";
import type { ContratoCtl, DatosControl, IndicadorCtl, Miembro, PistasCtl, ProcesoCtl } from "./tipos";

/**
 * Motor del control de socios: calcula, con los datos cargados en la app, la capacidad de cada empresa y la
 * viabilidad de un consorcio frente a un proceso. Sigue las mismas reglas que la Calificación (indicadores
 * agrupados por participación, patrimonio proporcional por integrante, máximo de contratos), pero sin acceso
 * a la base de datos para poder correr en el navegador. Donde falta información, lo dice en vez de suponer.
 */

export const fmtM = (n: number | null | undefined, d = 0) =>
  n == null ? "—" : `$${(n / 1e6).toLocaleString("es-CO", { maximumFractionDigits: d })} M`;
export const fmtN = (n: number | null | undefined, d = 0) =>
  n == null ? "—" : n.toLocaleString("es-CO", { maximumFractionDigits: d });

// ---------------------------------------------------------------------------------------------
// Pistas por palabras del objeto (para contratos sin cantidades certificadas)
// ---------------------------------------------------------------------------------------------

const RE_METALICA = /acero|hierro|d[uú]ctil|\bCCP\b|\bWSP\b|\bPCCP\b|l[ií]nea matriz|red(es)? matriz|conducci[oó]n|aducci[oó]n|impulsi[oó]n|\b(?:1[2-9]|[2-9]\d)\s?(?:"|”|pulgadas)/i;
const RE_SIN_ZANJA = /sin zanja|hincad|microt|ramming|perforaci[oó]n dirigida|trenchless|cipp/i;
const RE_ESTRUCTURAS = /box\s?c[ou]l?vert|tanque|c[aá]mara|bocatoma|desarenador|reservorio|muro|estructura hidr[aá]ulica|cajas?\b/i;
const RE_PAVIMENTO = /pavimento|pavimentaci[oó]n|adoqu|placa huella|and[eé]n/i;

export function pistasDeObjeto(objeto: string): PistasCtl {
  return {
    metalica: RE_METALICA.test(objeto),
    sinZanja: RE_SIN_ZANJA.test(objeto),
    // Las cámaras que piden los pliegos son de acueducto: un objeto solo de alcantarillado no es pista.
    estructuras: RE_ESTRUCTURAS.test(objeto) && !(/alcantarill|pluvial|sanitari/i.test(objeto) && !/acueducto/i.test(objeto)),
    pavimento: RE_PAVIMENTO.test(objeto),
  };
}

const clavePista = (c: CriterioActividad): keyof PistasCtl | null => {
  if (c.categoria === "tuberia_presion") return c.metodo === "sin_zanja" ? "sinZanja" : "metalica";
  if (c.categoria === "reparacion_puntual") return "metalica";
  if (c.categoria === "camara_o_estructura_concreto") return "estructuras";
  if (c.categoria === "pavimento") return "pavimento";
  return null;
};

// ---------------------------------------------------------------------------------------------
// Experiencia utilizable
// ---------------------------------------------------------------------------------------------

/** Un contrato cuenta como experiencia propia si no lo aportó un socio, no está en ejecución y el titular no es ajeno. */
export function esUtilizable(c: ContratoCtl, ventanaAnios: number, hoy: string): boolean {
  if (c.aportadaPorSocio || c.soloSupervision || c.estado === "en_ejecucion") return false;
  if (c.titular === "no_coincide" || c.titular === "subcontratista") return false;
  if (c.fecha) {
    const limite = new Date(hoy);
    limite.setFullYear(limite.getFullYear() - ventanaAnios);
    if (new Date(c.fecha) < limite) return false;
  }
  return true;
}

const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * ¿El contrato es del tipo de obra que el pliego acepta? Lo decide el objeto contra las categorías elegibles; un contrato
 * con cantidades extraídas o con una pista de actividad cuenta siempre. Sin objeto legible no se puede afirmar.
 */
export function esRelevante(c: ContratoCtl, p: ProcesoCtl): boolean {
  if (p.categorias.length === 0 || c.actividades.length > 0 || c.pistas.metalica || c.pistas.sinZanja || c.pistas.estructuras || c.pistas.pavimento) return true;
  const objeto = sinTildes(c.objeto);
  return p.categorias.some((cat) => objeto.includes(sinTildes(cat)));
}

export const smmlvPonderado = (c: ContratoCtl): number => (c.smmlv ?? 0) * ((c.part ?? 100) / 100);

export interface ResumenExperiencia {
  total: number;
  propios: number;
  deSocio: number;
  supervision: number;
  ajenos: number;
  verificados: number;
  conCertificado: number;
  conCantidades: number;
  sinFecha: number;
  participacionDudosa: number;
  smmlvUtilizable: number;
  mejores4: number;
}

export function resumenExperiencia(contratos: ContratoCtl[], ventanaAnios: number, hoy: string): ResumenExperiencia {
  const utiles = contratos.filter((c) => esUtilizable(c, ventanaAnios, hoy));
  const top4 = [...utiles].sort((a, b) => smmlvPonderado(b) - smmlvPonderado(a)).slice(0, 4);
  return {
    total: contratos.length,
    propios: utiles.length,
    deSocio: contratos.filter((c) => c.aportadaPorSocio).length,
    supervision: contratos.filter((c) => c.soloSupervision && !c.aportadaPorSocio).length,
    ajenos: contratos.filter((c) => c.titular === "no_coincide" || c.titular === "subcontratista").length,
    verificados: utiles.filter((c) => c.titular === "contratista_directo" || c.titular === "consorciado").length,
    conCertificado: utiles.filter((c) => c.certificado).length,
    conCantidades: utiles.filter((c) => c.actividades.length > 0).length,
    sinFecha: utiles.filter((c) => !c.fecha).length,
    participacionDudosa: utiles.filter((c) => c.participacionDudosa || c.part == null).length,
    smmlvUtilizable: utiles.reduce((s, c) => s + smmlvPonderado(c), 0),
    mejores4: top4.reduce((s, c) => s + smmlvPonderado(c), 0),
  };
}

// ---------------------------------------------------------------------------------------------
// Capacidad financiera
// ---------------------------------------------------------------------------------------------

export const capitalDeTrabajo = (i: IndicadorCtl | null | undefined): number | null =>
  i?.activoCorriente != null && i?.pasivoCorriente != null ? i.activoCorriente - i.pasivoCorriente : null;

export const indicadorCompleto = (i: IndicadorCtl | null | undefined): i is IndicadorCtl =>
  !!i &&
  i.activoCorriente != null &&
  i.pasivoCorriente != null &&
  i.activoTotal != null &&
  i.pasivoTotal != null &&
  i.patrimonio != null &&
  i.utilidadOperacional != null;

/** Mayor participación (%) que el patrimonio de la empresa le permite en el proceso. */
export function maxParticipacion(i: IndicadorCtl | null | undefined, p: ProcesoCtl): number | null {
  const u = umbrales(p.finReq).patrimonio;
  if (u == null || u <= 0 || i?.patrimonio == null) return null;
  return Math.min(100, (i.patrimonio / u) * 100);
}

export const maxIntegrantesDe = (p: ProcesoCtl): number =>
  p.maxIntegrantes ?? Math.max(1, Math.floor((100 - p.reglas.participacion_mayor_min_pct) / p.reglas.participacion_otros_min_pct) + 1);

export interface FilaAgrupada {
  etiqueta: string;
  valor: string;
  exigido: string;
  ok: boolean | null;
}

export interface FinancieroSimulado {
  veredicto: "cumple" | "no_cumple" | "sin_datos";
  margenCtn: number | null;
  integrantes: {
    id: string;
    pct: number;
    periodo: string | null;
    patrimonio: number | null;
    patrimonioMin: number | null;
    patrimonioOk: boolean | null;
    ctnAporte: number | null;
  }[];
  agrupados: FilaAgrupada[];
}

export function evaluarFinanciero(p: ProcesoCtl, miembros: Miembro[], datos: DatosControl): FinancieroSimulado {
  const u = umbrales(p.finReq);
  const inds = miembros.map((m) => datos.indicadores[m.empresaId] ?? null);
  const completos = inds.length > 0 && inds.every(indicadorCompleto);
  const pond = (f: (i: IndicadorCtl) => number | null) =>
    miembros.reduce((s, m, k) => s + (inds[k] ? (f(inds[k]!) ?? 0) * (m.pct / 100) : 0), 0);
  const AC = pond((i) => i.activoCorriente), PC = pond((i) => i.pasivoCorriente), AT = pond((i) => i.activoTotal);
  const PT = pond((i) => i.pasivoTotal), UO = pond((i) => i.utilidadOperacional), GI = pond((i) => i.gastosFinancieros), PA = pond((i) => i.patrimonio);

  const CT = p.finReq.capital_trabajo_suma ? inds.reduce((t, i) => t + (i ? (capitalDeTrabajo(i) ?? 0) : 0), 0) : AC - PC;
  const integrantes = miembros.map((m, k) => {
    const ind = inds[k];
    const minimo = u.patrimonio != null ? u.patrimonio * (m.pct / 100) : null;
    return {
      id: m.empresaId,
      pct: m.pct,
      periodo: ind?.periodo ?? null,
      patrimonio: ind?.patrimonio ?? null,
      patrimonioMin: minimo,
      patrimonioOk: ind?.patrimonio == null || minimo == null ? null : ind.patrimonio >= minimo,
      ctnAporte: ind ? (capitalDeTrabajo(ind) ?? 0) * (m.pct / 100) : null,
    };
  });

  const f2 = (x: number | null, d = 2) => fmtN(x, d);
  const agrupados: FilaAgrupada[] = [
    { etiqueta: "Índice de liquidez", valor: completos && PC ? f2(AC / PC) : "—", exigido: u.liquidez != null ? `≥ ${f2(u.liquidez)}` : "—", ok: !completos || u.liquidez == null || !PC ? null : AC / PC >= u.liquidez },
    { etiqueta: "Nivel de endeudamiento", valor: completos && AT ? f2(PT / AT) : "—", exigido: u.endeudamiento != null ? `≤ ${f2(u.endeudamiento)}` : "—", ok: !completos || u.endeudamiento == null || !AT ? null : PT / AT <= u.endeudamiento },
    { etiqueta: "Cobertura de intereses", valor: completos ? (GI ? f2(UO / GI) : "sin gastos financieros") : "—", exigido: u.cobertura != null ? `≥ ${f2(u.cobertura)}` : "—", ok: !completos || u.cobertura == null ? null : GI === 0 ? true : UO / GI >= u.cobertura },
    { etiqueta: p.finReq.capital_trabajo_suma ? "Capital de trabajo (suma de los integrantes)" : "Capital de trabajo (ponderado)", valor: completos ? fmtM(CT) : "—", exigido: u.capitalTrabajo != null ? `≥ ${fmtM(u.capitalTrabajo)}` : "—", ok: !completos || u.capitalTrabajo == null ? null : CT >= u.capitalTrabajo },
    {
      etiqueta: "Patrimonio de cada integrante",
      valor: integrantes.map((x) => (x.patrimonioOk == null ? "?" : x.patrimonioOk ? "✓" : "✗")).join(" "),
      exigido: u.patrimonio != null ? `≥ ${fmtM(u.patrimonio)} × su %` : "—",
      ok: integrantes.some((x) => x.patrimonioOk === false) ? false : integrantes.some((x) => x.patrimonioOk == null) ? null : true,
    },
    { etiqueta: "Rentabilidad del patrimonio", valor: completos && PA ? `${f2((UO / PA) * 100, 1)} %` : "—", exigido: u.roe != null ? `≥ ${f2(u.roe * 100, 1)} %` : "—", ok: !completos || u.roe == null || !PA ? null : UO / PA >= u.roe },
    { etiqueta: "Rentabilidad del activo", valor: completos && AT ? `${f2((UO / AT) * 100, 1)} %` : "—", exigido: u.roa != null ? `≥ ${f2(u.roa * 100, 1)} %` : "—", ok: !completos || u.roa == null || !AT ? null : UO / AT >= u.roa },
  ];
  const oks = agrupados.map((a) => a.ok);
  const veredicto = oks.includes(false) ? "no_cumple" : oks.includes(null) ? "sin_datos" : "cumple";
  return { veredicto, margenCtn: completos && u.capitalTrabajo != null ? CT - u.capitalTrabajo : null, integrantes, agrupados };
}

// ---------------------------------------------------------------------------------------------
// Simulación completa
// ---------------------------------------------------------------------------------------------

export interface ActividadSimulada {
  numero: number;
  descripcion: string;
  estado: "confirmada" | "pista" | "falta";
  detalle: string;
  aportes: { empresaId: string; texto: string }[];
}

export interface SmmlvSimulado {
  capacidad: number;
  requerido: number | null;
  ok: boolean | null;
  aporteMayor: number;
  mayorOk: boolean | null;
  contratos: { empresaId: string; entidad: string; objeto: string; aporte: number; via?: string }[];
}

export interface ResultadoSimulacion {
  reglas: { etiqueta: string; ok: boolean | null; detalle: string }[];
  financiero: FinancieroSimulado;
  tecnico: { actividades: ActividadSimulada[]; smmlv: SmmlvSimulado; veredicto: "confirmado" | "con_pistas" | "incompleto" };
  alertas: string[];
}

export function evaluarEquipo(p: ProcesoCtl, miembros: Miembro[], datos: DatosControl): ResultadoSimulacion {
  const nombre = (id: string) => datos.empresas.find((e) => e.id === id)?.nombre ?? "Empresa";
  const n = miembros.length;
  const pcts = miembros.map((m) => m.pct);
  const suma = pcts.reduce((a, b) => a + b, 0);
  const orden = [...pcts].sort((a, b) => b - a);
  const maxInt = maxIntegrantesDe(p);
  const reglas: ResultadoSimulacion["reglas"] = [
    { etiqueta: "Los porcentajes suman 100 %", ok: Math.abs(suma - 100) < 0.01, detalle: `Suman ${fmtN(suma, 1)} %` },
    { etiqueta: `Máximo ${maxInt} integrantes`, ok: n <= maxInt, detalle: `${n} integrantes (con ${p.reglas.participacion_mayor_min_pct} % + ${p.reglas.participacion_otros_min_pct} % por cada otro, no caben más)` },
  ];
  if (n > 1) {
    reglas.push(
      { etiqueta: `Un integrante con ≥ ${p.reglas.participacion_mayor_min_pct} %`, ok: orden[0] >= p.reglas.participacion_mayor_min_pct, detalle: `Mayor: ${fmtN(orden[0], 1)} %` },
      { etiqueta: `Los demás con ≥ ${p.reglas.participacion_otros_min_pct} %`, ok: orden.slice(1).every((x) => x >= p.reglas.participacion_otros_min_pct), detalle: `Menor: ${fmtN(orden[orden.length - 1], 1)} %` },
    );
  }

  const financiero = evaluarFinanciero(p, miembros, datos);

  // ----- técnico -----
  const utiles = new Map<string, ContratoCtl[]>();
  for (const m of miembros) {
    utiles.set(
      m.empresaId,
      datos.contratos.filter((c) => c.empresaId === m.empresaId && esUtilizable(c, p.ventanaAnios, datos.hoy) && esRelevante(c, p)),
    );
  }
  // Un contrato que figura en el RUP de dos integrantes se cuenta una sola vez (el original, no la copia).
  const idsUtiles = new Set([...utiles.values()].flat().map((c) => c.id));
  let duplicados = 0;
  for (const [id, lista] of utiles) {
    const sin = lista.filter((c) => !(c.duplicaDe && idsUtiles.has(c.duplicaDe)));
    duplicados += lista.length - sin.length;
    utiles.set(id, sin);
  }
  const todos = miembros.flatMap((m) => (utiles.get(m.empresaId) ?? []).map((c) => ({ empresaId: m.empresaId, c })));
  const picks = new Map<string, { empresaId: string; c: ContratoCtl }>();

  const actividades: ActividadSimulada[] = p.actividades.map((a) => {
    const evaluadas = a.alternativas.map((c) => {
      const aportes = todos
        .map((x) => ({ x, cant: cantidadAcreditada(x.c.actividades, c, `${x.c.sector ?? ""} ${x.c.objeto}`, x.c.part) }))
        .filter((y) => y.cant > 0)
        .sort((y, z) => z.cant - y.cant);
      let acum = 0;
      const usados: typeof aportes = [];
      let ok = false;
      for (const y of aportes) {
        usados.push(y);
        acum += y.cant;
        if (c.estricto ? acum > c.minimo : acum >= c.minimo) { ok = true; break; }
      }
      return { c, aportes, usados, acum: ok ? acum : aportes.reduce((s, y) => s + y.cant, 0), ok };
    });
    const ganadora = evaluadas.find((x) => x.ok);
    if (ganadora) {
      for (const y of ganadora.usados) picks.set(y.x.c.id, y.x);
      const porMiembro = new Map<string, number>();
      for (const y of ganadora.usados) porMiembro.set(y.x.empresaId, (porMiembro.get(y.x.empresaId) ?? 0) + y.cant);
      return {
        numero: a.numero,
        descripcion: a.descripcion,
        estado: "confirmada",
        detalle: `${fmtN(ganadora.acum, 1)} ${ganadora.c.unidad} certificados con ${ganadora.usados.length} contrato(s); se exigen ${ganadora.c.estricto ? "más de " : ""}${fmtN(ganadora.c.minimo)} (${textoCriterio(ganadora.c)})`,
        aportes: [...porMiembro].map(([empresaId, cant]) => ({ empresaId, texto: `${fmtN(cant, 1)} ${ganadora.c.unidad}` })),
      } as ActividadSimulada;
    }
    const pistas: { empresaId: string; n: number; ejemplo: string }[] = [];
    for (const m of miembros) {
      const hallados = (utiles.get(m.empresaId) ?? []).filter((x) => x.actividades.length === 0 && a.alternativas.some((c) => { const k = clavePista(c); return k != null && x.pistas[k]; }));
      if (hallados.length) pistas.push({ empresaId: m.empresaId, n: hallados.length, ejemplo: [...hallados].sort((x, y) => smmlvPonderado(y) - smmlvPonderado(x))[0].objeto.slice(0, 70) });
    }
    const mejor = [...evaluadas].sort((x, y) => y.acum / (y.c.minimo || 1) - x.acum / (x.c.minimo || 1))[0];
    const confirmado = mejor && mejor.acum > 0 ? `${fmtN(mejor.acum, 1)} ${mejor.c.unidad} certificados de ${fmtN(mejor.c.minimo)} exigidos` : `0 certificados de ${fmtN(a.alternativas[0]?.minimo)} ${a.alternativas[0]?.unidad ?? ""} exigidos`;
    if (pistas.length) {
      return {
        numero: a.numero,
        descripcion: a.descripcion,
        estado: "pista",
        detalle: `${confirmado}. Hay contratos cuyo objeto sugiere esta actividad, pero sin cantidades certificadas.`,
        aportes: pistas.map((x) => ({ empresaId: x.empresaId, texto: `${x.n} contrato(s) con pista, p. ej. «${x.ejemplo}»` })),
      } as ActividadSimulada;
    }
    return { numero: a.numero, descripcion: a.descripcion, estado: "falta", detalle: `${confirmado}. Ningún integrante tiene evidencia de esta actividad.`, aportes: [] } as ActividadSimulada;
  });

  // ----- SMMLV: los contratos que acreditan las actividades, uno por integrante como mínimo, y el resto de cupo con los más grandes -----
  let seleccion = [...picks.values()];
  const exceso = seleccion.length > p.maxContratos;
  if (exceso) seleccion = seleccion.sort((a, b) => smmlvPonderado(b.c) - smmlvPonderado(a.c)).slice(0, p.maxContratos);
  const sinAporte: string[] = [];
  for (const m of miembros) {
    if (seleccion.some((s) => s.empresaId === m.empresaId)) continue;
    const mejor = [...(utiles.get(m.empresaId) ?? [])].sort((a, b) => smmlvPonderado(b) - smmlvPonderado(a))[0];
    if (mejor && seleccion.length < p.maxContratos) seleccion.push({ empresaId: m.empresaId, c: mejor });
    else sinAporte.push(m.empresaId);
  }
  // El integrante mayor debe aportar al menos cierta parte del valor exigido: se le dan primero los cupos que sobran.
  const idMayor = miembros[pcts.indexOf(Math.max(...pcts))]?.empresaId;
  const minMayor = p.smmlvMin != null && n > 1 ? (p.reglas.aporte_mayor_pct_valor / 100) * p.smmlvMin : 0;
  const delMayor = (utiles.get(idMayor) ?? []).filter((c) => !seleccion.some((s) => s.c.id === c.id)).sort((a, b) => smmlvPonderado(b) - smmlvPonderado(a));
  while (seleccion.length < p.maxContratos && delMayor.length && seleccion.filter((x) => x.empresaId === idMayor).reduce((t, x) => t + smmlvPonderado(x.c), 0) < minMayor) {
    seleccion.push({ empresaId: idMayor, c: delMayor.shift()! });
  }
  const resto = todos.filter((x) => !seleccion.some((s) => s.c.id === x.c.id)).sort((a, b) => smmlvPonderado(b.c) - smmlvPonderado(a.c));
  while (seleccion.length < p.maxContratos && resto.length) seleccion.push(resto.shift()!);
  const capacidad = seleccion.reduce((s, x) => s + smmlvPonderado(x.c), 0);
  const idxMayor = pcts.indexOf(Math.max(...pcts));
  const aporteMayor = seleccion.filter((x) => x.empresaId === miembros[idxMayor]?.empresaId).reduce((s, x) => s + smmlvPonderado(x.c), 0);
  const requerido = p.smmlvMin;
  const smmlv: SmmlvSimulado = {
    capacidad,
    requerido,
    ok: requerido == null ? null : capacidad >= requerido,
    aporteMayor,
    mayorOk: requerido == null || n < 2 ? null : aporteMayor >= (p.reglas.aporte_mayor_pct_valor / 100) * requerido,
    contratos: seleccion.map((x) => ({ empresaId: x.empresaId, entidad: x.c.entidad, objeto: x.c.objeto.slice(0, 90), aporte: smmlvPonderado(x.c), via: x.c.viaControl })),
  };
  const hayFalta = actividades.some((a) => a.estado === "falta");
  const hayPista = actividades.some((a) => a.estado === "pista");
  const veredictoTec = hayFalta || exceso || sinAporte.length > 0 || smmlv.ok === false || smmlv.mayorOk === false ? "incompleto" : hayPista ? "con_pistas" : "confirmado";

  // ----- alertas -----
  const alertas: string[] = [];
  for (const m of miembros) {
    const r = datos.resumen[m.empresaId];
    const nom = nombre(m.empresaId);
    if (!datos.indicadores[m.empresaId]) alertas.push(`${nom}: no tiene indicadores financieros cargados.`);
    else if (!indicadorCompleto(datos.indicadores[m.empresaId])) alertas.push(`${nom}: sus indicadores están incompletos (faltan activos, pasivos o utilidad).`);
    if (r?.rupEstado === "vencido") alertas.push(`${nom}: el RUP está vencido (${r.rupVence}).`);
    if (r?.rupEstado === "sin_rup") alertas.push(`${nom}: no tiene RUP cargado.`);
    const del = datos.contratos.filter((c) => c.empresaId === m.empresaId);
    const socio = del.filter((c) => c.aportadaPorSocio).length;
    if (socio) alertas.push(`${nom}: ${socio} contrato(s) aportados por un socio no cuentan.`);
    const sinCert = (utiles.get(m.empresaId) ?? []).filter((c) => !c.certificado).length;
    const totalUtiles = (utiles.get(m.empresaId) ?? []).length;
    if (totalUtiles && sinCert === totalUtiles) alertas.push(`${nom}: ninguno de sus contratos tiene certificado cargado.`);
    for (const v of r?.vinculadas ?? []) if (miembros.some((o) => datos.empresas.find((e) => e.id === o.empresaId)?.nombre === v)) alertas.push(`${nom} y ${v} están vinculadas (comparten representante o socio).`);
  }
  const prestados = new Map<string, number>();
  for (const x of seleccion) if (x.c.viaControl) prestados.set(`${x.c.viaControl} → ${nombre(x.empresaId)}`, (prestados.get(`${x.c.viaControl} → ${nombre(x.empresaId)}`) ?? 0) + 1);
  for (const [rel, cuantos] of prestados) alertas.push(`Escenario hipotético: ${cuantos} contrato(s) vienen de una relación de control (${rel}). Solo valen si el control es real y está inscrito en Cámara de Comercio.`);
  if (duplicados) alertas.push(`${duplicados} contrato(s) figuran en el RUP de dos integrantes: se cuentan una sola vez.`);
  const iaSinRevisar = [...picks.values()].filter((x) => x.c.iaSinRevisar).length;
  if (iaSinRevisar) alertas.push(`Las cantidades de ${iaSinRevisar} contrato(s) que acreditan actividades salen de una extracción con IA sin revisión humana.`);
  if (exceso) alertas.push(`Las actividades confirmadas necesitan ${picks.size} contratos y el pliego permite máximo ${p.maxContratos}.`);
  for (const id of sinAporte) alertas.push(`${nombre(id)} no alcanza a aportar un contrato habilitante dentro del máximo de ${p.maxContratos}.`);
  return { reglas, financiero, tecnico: { actividades, smmlv, veredicto: veredictoTec }, alertas: [...new Set(alertas)] };
}

// ---------------------------------------------------------------------------------------------
// Repartos sugeridos
// ---------------------------------------------------------------------------------------------

export interface RepartoSugerido {
  miembros: Miembro[];
  margenCtn: number;
}

function* permutaciones<T>(a: T[]): Generator<T[]> {
  if (a.length <= 1) { yield a; return; }
  for (let i = 0; i < a.length; i++) for (const r of permutaciones([...a.slice(0, i), ...a.slice(i + 1)])) yield [a[i], ...r];
}

/** Repartos (en pasos de 5 %) que cumplen las reglas del plural y todos los indicadores financieros, del que más margen deja al que menos. */
export function sugerirRepartos(p: ProcesoCtl, ids: string[], datos: DatosControl, max = 6): RepartoSugerido[] {
  const n = ids.length;
  if (n < 2 || n > maxIntegrantesDe(p)) return [];
  const minMayor = p.reglas.participacion_mayor_min_pct, minOtros = p.reglas.participacion_otros_min_pct;
  const salida: RepartoSugerido[] = [];
  const rango: number[] = [];
  for (let x = minOtros; x <= 100 - minOtros * (n - 1); x += 5) rango.push(x);
  const combos: number[][] = [];
  const rec = (pref: number[]) => {
    if (pref.length === n) { if (pref.reduce((a, b) => a + b, 0) === 100 && Math.max(...pref) >= minMayor) combos.push(pref); return; }
    for (const x of rango) rec([...pref, x]);
  };
  rec([]);
  const unicos = new Set<string>();
  for (const c of combos) for (const perm of permutaciones(c)) unicos.add(perm.join("-"));
  for (const clave of unicos) {
    const pcts = clave.split("-").map(Number);
    const miembros = ids.map((id, i) => ({ empresaId: id, pct: pcts[i] }));
    const f = evaluarFinanciero(p, miembros, datos);
    if (f.veredicto !== "cumple" || f.margenCtn == null) continue;
    salida.push({ miembros, margenCtn: f.margenCtn });
  }
  return salida.sort((a, b) => b.margenCtn - a.margenCtn).slice(0, max);
}

// ---------------------------------------------------------------------------------------------
// Escenarios de control (hipótesis): la experiencia de una matriz, filial o subordinada del integrante
// ---------------------------------------------------------------------------------------------

/** `origenId` prestaría su experiencia a `destinoId` por ser su matriz, filial o subordinada. */
export interface RelacionControl {
  origenId: string;
  destinoId: string;
}

/** Clave de un grupo de contratos aportados por un mismo accionista, socio o constituyente de una empresa. */
export const claveSocio = (empresaId: string, aportante: string | null | undefined) => `${empresaId}|${aportante ?? ""}`;

/**
 * Devuelve los datos con los contratos de cada origen copiados al integrante que los usaría, y con la experiencia aportada por
 * socios de las claves de `sociosValidos` tratada como válida (hipótesis de que el aportante controla a la empresa).
 */
export function conControl(datos: DatosControl, relaciones: RelacionControl[], miembros: Miembro[], sociosValidos: string[] = []): { datos: DatosControl; avisos: string[] } {
  const nombre = (id: string) => datos.empresas.find((e) => e.id === id)?.nombre ?? "Empresa";
  const natural = (id: string) => datos.empresas.find((e) => e.id === id)?.tipoPersona === "natural";
  const avisos: string[] = [];
  const extra: ContratoCtl[] = [];
  const origenesUsados = new Set<string>();
  const validas = new Set(sociosValidos);
  for (const r of relaciones) {
    if (!r.origenId || !r.destinoId || r.origenId === r.destinoId) continue;
    if (!miembros.some((m) => m.empresaId === r.destinoId)) continue;
    if (miembros.some((m) => m.empresaId === r.origenId)) {
      avisos.push(`${nombre(r.origenId)} ya es integrante: usa su propia experiencia, no hace falta la relación de control.`);
      continue;
    }
    if (origenesUsados.has(r.origenId)) {
      avisos.push(`${nombre(r.origenId)} figura como origen más de una vez; un mismo contrato no puede acreditarse dos veces, solo se toma la primera relación.`);
      continue;
    }
    origenesUsados.add(r.origenId);
    if (natural(r.origenId)) avisos.push(`${nombre(r.origenId)} es persona natural: la Nota 2 pide un certificado de existencia y representación legal de la matriz, así que esta relación probablemente no sirva (hay que preguntárselo a la EAAB).`);
    if (natural(r.destinoId)) avisos.push(`${nombre(r.destinoId)} es persona natural: no puede ser matriz, filial ni subordinada en el sentido de la cláusula.`);
    for (const c of datos.contratos.filter((x) => x.empresaId === r.origenId)) {
      const aceptada = c.aportadaPorSocio && validas.has(claveSocio(r.origenId, c.aportante));
      extra.push({ ...c, id: `${c.id}~${r.destinoId}`, empresaId: r.destinoId, viaControl: nombre(r.origenId), aportadaPorSocio: aceptada ? false : c.aportadaPorSocio });
    }
  }

  // Experiencia aportada por socios que se acepta como válida (el aportante sería la matriz o controlante)
  let contratos = datos.contratos;
  const aceptados = new Map<string, number>();
  if (validas.size) {
    contratos = contratos.map((c) => {
      if (!c.aportadaPorSocio || !miembros.some((m) => m.empresaId === c.empresaId) || !validas.has(claveSocio(c.empresaId, c.aportante))) return c;
      const k = `${c.aportante ?? "aportante sin nombre en el RUP"} → ${nombre(c.empresaId)}`;
      aceptados.set(k, (aceptados.get(k) ?? 0) + 1);
      return { ...c, aportadaPorSocio: false, viaControl: c.aportante ?? "accionistas o constituyentes" };
    });
    for (const [k, n] of aceptados) {
      avisos.push(`Se acepta como válida la experiencia aportada por ${k} (${n} contratos). Solo vale si el aportante controla de verdad a la empresa, el control está inscrito y se aportan la carta de autorización, el certificado de existencia del aportante y el RUP en firme (Notas 1 a 3).`);
      const aportante = k.split(" → ")[0];
      const clave = (t: string) => sinTildes(t).split(" ").slice(0, 2).join(" ");
      if (datos.empresas.some((e) => e.tipoPersona === "natural" && clave(aportante) === clave(e.nombre))) {
        avisos.push(`${aportante} es persona natural: la cláusula habla de «sociedad» matriz y de su certificado de existencia y representación legal; es el punto jurídico por resolver.`);
      }
    }
  }
  return { datos: extra.length || validas.size ? { ...datos, contratos: [...contratos, ...extra] } : datos, avisos };
}

export interface ExploracionControl {
  /** «prestamo»: otra empresa presta su experiencia; «socios»: se acepta la experiencia que el RUP del integrante atribuye a sus accionistas. */
  tipo: "prestamo" | "socios";
  /** Para «socios»: claves de los aportantes aceptados. */
  claves?: string[];
  origenId: string;
  destinoId: string;
  veredicto: ResultadoSimulacion["tecnico"]["veredicto"];
  confirmadas: number;
  pistas: number;
  faltas: number;
  capacidad: number;
  smmlvOk: boolean | null;
  /** Contratos del origen que entrarían dentro del máximo permitido. */
  contratosUsados: number;
  deltaCapacidad: number;
}

const RANGO_VEREDICTO = { confirmado: 0, con_pistas: 1, incompleto: 2 } as const;

/** Prueba, para cada integrante, qué pasaría si cada otra empresa fuera su matriz, filial o subordinada. */
export function explorarControl(p: ProcesoCtl, miembros: Miembro[], datos: DatosControl): ExploracionControl[] {
  const base = evaluarEquipo(p, miembros, datos);
  const filas: ExploracionControl[] = [];
  const candidatos = datos.empresas.filter((e) => !miembros.some((m) => m.empresaId === e.id) && datos.contratos.some((c) => c.empresaId === e.id && esUtilizable(c, p.ventanaAnios, datos.hoy) && esRelevante(c, p)));
  for (const m of miembros) {
    for (const o of candidatos) {
      const { datos: d } = conControl(datos, [{ origenId: o.id, destinoId: m.empresaId }], miembros);
      const r = evaluarEquipo(p, miembros, d);
      const usados = r.tecnico.smmlv.contratos.filter((c) => c.via).length;
      const act = r.tecnico.actividades;
      const baseAct = base.tecnico.actividades;
      const mejoraAct = act.filter((a, i) => a.estado === "confirmada" && baseAct[i].estado !== "confirmada").length;
      const menosFaltas = baseAct.filter((a) => a.estado === "falta").length > act.filter((a) => a.estado === "falta").length;
      if (!mejoraAct && !menosFaltas) continue;
      filas.push({
        tipo: "prestamo",
        origenId: o.id,
        destinoId: m.empresaId,
        veredicto: r.tecnico.veredicto,
        confirmadas: act.filter((a) => a.estado === "confirmada").length,
        pistas: act.filter((a) => a.estado === "pista").length,
        faltas: act.filter((a) => a.estado === "falta").length,
        capacidad: r.tecnico.smmlv.capacidad,
        smmlvOk: r.tecnico.smmlv.ok,
        contratosUsados: usados,
        deltaCapacidad: r.tecnico.smmlv.capacidad - base.tecnico.smmlv.capacidad,
      });
    }
  }
  for (const m of miembros) {
    const claves = [...new Set(datos.contratos.filter((c) => c.empresaId === m.empresaId && c.aportadaPorSocio).map((c) => claveSocio(c.empresaId, c.aportante)))];
    if (!claves.length) continue;
    const { datos: d } = conControl(datos, [], miembros, claves);
    const r = evaluarEquipo(p, miembros, d);
    const act = r.tecnico.actividades;
    const baseAct = base.tecnico.actividades;
    const mejoraAct = act.filter((a, i) => a.estado === "confirmada" && baseAct[i].estado !== "confirmada").length;
    const menosFaltas = baseAct.filter((a) => a.estado === "falta").length > act.filter((a) => a.estado === "falta").length;
    if (!mejoraAct && !menosFaltas) continue;
    filas.push({
      tipo: "socios",
      claves,
      origenId: m.empresaId,
      destinoId: m.empresaId,
      veredicto: r.tecnico.veredicto,
      confirmadas: act.filter((a) => a.estado === "confirmada").length,
      pistas: act.filter((a) => a.estado === "pista").length,
      faltas: act.filter((a) => a.estado === "falta").length,
      capacidad: r.tecnico.smmlv.capacidad,
      smmlvOk: r.tecnico.smmlv.ok,
      contratosUsados: r.tecnico.smmlv.contratos.filter((c) => c.via).length,
      deltaCapacidad: r.tecnico.smmlv.capacidad - base.tecnico.smmlv.capacidad,
    });
  }
  return filas
    .sort((a, b) => RANGO_VEREDICTO[a.veredicto] - RANGO_VEREDICTO[b.veredicto] || a.faltas - b.faltas || b.confirmadas - a.confirmadas || b.capacidad - a.capacidad)
    .slice(0, 8);
}
