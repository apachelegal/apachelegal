import type { ContratoInterventoria } from "./datos";

/**
 * Evaluación de la experiencia habilitante de una invitación de interventoría de la EAAB: hasta N contratos de interventoría
 * terminados en la ventana de años, cuya suma en SMMLV (ponderada por la participación en consorcio o unión temporal) alcance
 * un porcentaje del presupuesto oficial, que acrediten cada actividad exigida; en oferta plural todos los integrantes aportan
 * experiencia y el de mayor participación aporta al menos una parte del valor exigido. Las cantidades (m³, metros) no están
 * en la base: cada actividad se acredita por la etiqueta de obra del contrato, que hay que confirmar con el certificado.
 */

export interface CriterioInterventoria {
  /** Id de la etiqueta de obra (ver `ETIQUETAS`). */
  etiqueta: string;
  /** Otras etiquetas que también acreditan la actividad cuando el pliego da dos caminos («o»). */
  tambien?: string[];
  texto: string;
}

const etiquetasDe = (c: CriterioInterventoria) => [c.etiqueta, ...(c.tambien ?? [])];

export interface PerfilInterventoria {
  nombre: string;
  poPesos: number;
  /** Salario mínimo mensual con el que la invitación convierte el presupuesto a SMMLV. */
  smlmv: number;
  /** Porcentaje del presupuesto oficial (en SMMLV) que deben sumar los contratos. */
  porcentajePO: number;
  maxContratos: number;
  ventanaAnios: number;
  fechaCierre: string;
  criterios: CriterioInterventoria[];
  todosAportan: boolean;
  /** Parte del valor exigido que debe aportar el integrante de mayor participación. */
  mayorValorPct: number;
  /** Si es true, también valen los contratos de consultoría. */
  aceptaConsultoria: boolean;
}

export interface MiembroEquipo {
  empresaId: string;
  pct: number;
}

export interface Chequeo {
  titulo: string;
  estado: "ok" | "por_confirmar" | "falta";
  detalle: string;
}

export interface ElegidoInterventoria {
  contrato: ContratoInterventoria;
  aporte: number;
  cubre: string[];
}

export interface ResultadoInterventoria {
  veredicto: "cumple" | "por_confirmar" | "no_cumple";
  necesario: number;
  acreditado: number;
  elegidos: ElegidoInterventoria[];
  chequeos: Chequeo[];
  avisos: string[];
  /** Para ordenar equipos: más alto es mejor. */
  puntaje: number;
}

export const smmlvNecesario = (p: PerfilInterventoria) => (p.poPesos / p.smlmv) * (p.porcentajePO / 100);

function sumarAnios(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() - n);
  return d.toISOString().slice(0, 10);
}

/** Contratos de un integrante que la EAAB aceptaría para esta invitación, con los avisos de lo que habría que verificar. */
export function contratosValidos(p: PerfilInterventoria, contratos: ContratoInterventoria[], empresaId: string) {
  const desde = sumarAnios(p.fechaCierre, p.ventanaAnios);
  return contratos.filter(
    (c) =>
      c.empresaId === empresaId &&
      !c.deSocio &&
      c.smmlv != null &&
      (c.tipo === "interventoria" || p.aceptaConsultoria) &&
      (c.fecha == null || (c.fecha >= desde && c.fecha <= p.fechaCierre)),
  );
}

const aporteDe = (c: ContratoInterventoria) => (c.smmlv ?? 0) * ((c.participacion ?? 100) / 100);

function* subconjuntos<T>(lista: T[], max: number, desde = 0, actual: T[] = []): Generator<T[]> {
  if (actual.length) yield actual;
  if (actual.length === max) return;
  for (let i = desde; i < lista.length; i++) yield* subconjuntos(lista, max, i + 1, [...actual, lista[i]]);
}

function evaluarSeleccion(p: PerfilInterventoria, equipo: MiembroEquipo[], elegidos: ContratoInterventoria[], necesario: number): ResultadoInterventoria {
  const items: ElegidoInterventoria[] = elegidos.map((c) => ({ contrato: c, aporte: aporteDe(c), cubre: [] }));
  const chequeos: Chequeo[] = [];
  const avisos: string[] = [];
  let puntaje = 0;

  for (const cr of p.criterios) {
    const ets = etiquetasDe(cr);
    const conf = items.filter((x) => ets.some((e) => x.contrato.etiquetas.includes(e)));
    const sug = items.filter((x) => !ets.some((e) => x.contrato.etiquetas.includes(e)) && ets.some((e) => x.contrato.sugeridas.includes(e)));
    if (conf.length) {
      conf.forEach((x) => x.cubre.push(cr.texto));
      chequeos.push({ titulo: cr.texto, estado: "ok", detalle: `Confirmada en ${conf.length} contrato(s).` });
      puntaje += 1;
    } else if (sug.length) {
      sug.forEach((x) => x.cubre.push(cr.texto));
      chequeos.push({ titulo: cr.texto, estado: "por_confirmar", detalle: `El objeto de ${sug.length} contrato(s) sugiere que la cubre; falta confirmarlo con el certificado (cantidades incluidas).` });
      puntaje += 0.5;
    } else {
      chequeos.push({ titulo: cr.texto, estado: "falta", detalle: "Ningún contrato elegido la acredita." });
    }
  }

  const acreditado = items.reduce((s, x) => s + x.aporte, 0);
  const valorOk = acreditado >= necesario;
  chequeos.push({
    titulo: `Valor: ${p.porcentajePO}% del presupuesto en SMMLV`,
    estado: valorOk ? "ok" : "falta",
    detalle: `${Math.round(acreditado).toLocaleString("es-CO")} de ${Math.round(necesario).toLocaleString("es-CO")} SMMLV${valorOk ? "" : ` (faltan ${Math.round(necesario - acreditado).toLocaleString("es-CO")})`}.`,
  });
  if (valorOk) puntaje += 1;
  else puntaje += Math.min(0.9, acreditado / necesario);

  if (equipo.length > 1) {
    if (p.todosAportan) {
      const sin = equipo.filter((m) => !items.some((x) => x.contrato.empresaId === m.empresaId));
      chequeos.push({ titulo: "Todos los integrantes aportan experiencia", estado: sin.length ? "falta" : "ok", detalle: sin.length ? `${sin.length} integrante(s) sin contrato elegido.` : "Cada integrante aporta al menos un contrato." });
      if (!sin.length) puntaje += 1;
    }
    const mayor = [...equipo].sort((a, b) => b.pct - a.pct)[0];
    const deMayor = items.filter((x) => x.contrato.empresaId === mayor.empresaId).reduce((s, x) => s + x.aporte, 0);
    const minimo = necesario * (p.mayorValorPct / 100);
    const okMayor = deMayor >= minimo;
    chequeos.push({
      titulo: `El de mayor participación aporta ≥ ${p.mayorValorPct}% del valor exigido`,
      estado: okMayor ? "ok" : "falta",
      detalle: `${Math.round(deMayor).toLocaleString("es-CO")} de ${Math.round(minimo).toLocaleString("es-CO")} SMMLV.`,
    });
    if (okMayor) puntaje += 1;
  }

  if (items.some((x) => x.contrato.fecha == null)) avisos.push("Hay contratos sin fecha de terminación: hay que comprobar que caigan en la ventana de años.");
  if (items.some((x) => x.contrato.participacion == null)) avisos.push("Hay contratos sin participación cargada: se contaron al 100 % y puede sobrar valor.");
  if (items.some((x) => !x.contrato.consecutivoRup)) avisos.push("Hay contratos sin consecutivo RUP: la EAAB verifica la experiencia contra el RUP y debe estar en firme.");
  if (items.some((x) => x.contrato.documentos.length === 0)) avisos.push("Hay contratos sin certificado cargado.");
  if (items.some((x) => x.contrato.tipo === "consultoria")) avisos.push("Se usan contratos de consultoría; confirma que la invitación los acepta.");

  const hayFalta = chequeos.some((c) => c.estado === "falta");
  const hayPendiente = chequeos.some((c) => c.estado === "por_confirmar");
  return { veredicto: hayFalta ? "no_cumple" : hayPendiente ? "por_confirmar" : "cumple", necesario, acreditado, elegidos: items, chequeos, avisos, puntaje };
}

/** Busca la mejor combinación de contratos (máximo N) que tienen entre todos los integrantes. */
export function evaluarEquipoInterventoria(p: PerfilInterventoria, equipo: MiembroEquipo[], contratos: ContratoInterventoria[]): ResultadoInterventoria {
  const necesario = smmlvNecesario(p);
  const validos = equipo.flatMap((m) => contratosValidos(p, contratos, m.empresaId));
  if (validos.length === 0) {
    return { veredicto: "no_cumple", necesario, acreditado: 0, elegidos: [], puntaje: 0, avisos: [], chequeos: [{ titulo: "Contratos de interventoría", estado: "falta", detalle: "Ningún integrante tiene contratos de interventoría utilizables en la ventana." }] };
  }
  const ids = new Set(p.criterios.flatMap(etiquetasDe));
  const relevantes = validos.filter((c) => [...ids].some((e) => c.etiquetas.includes(e) || c.sugeridas.includes(e)));
  const grandes = [...validos].sort((a, b) => aporteDe(b) - aporteDe(a)).slice(0, 8);
  const candidatos = [...new Map([...relevantes.slice(0, 10), ...grandes].map((c) => [c.id, c])).values()].slice(0, 15);
  let mejor: ResultadoInterventoria | null = null;
  for (const sel of subconjuntos(candidatos, p.maxContratos)) {
    const r = evaluarSeleccion(p, equipo, sel, necesario);
    if (!mejor || r.puntaje > mejor.puntaje + 1e-9 || (Math.abs(r.puntaje - mejor.puntaje) < 1e-9 && (r.elegidos.length < mejor.elegidos.length || (r.elegidos.length === mejor.elegidos.length && r.acreditado > mejor.acreditado)))) mejor = r;
  }
  return mejor!;
}

export interface EquipoSugerido {
  equipo: MiembroEquipo[];
  resultado: ResultadoInterventoria;
}

/** Prueba cada empresa sola y cada pareja (60/40) y devuelve las mejores. */
export function explorarEquipos(p: PerfilInterventoria, contratos: ContratoInterventoria[], empresaIds: string[], limite = 8): EquipoSugerido[] {
  const con = empresaIds.filter((id) => contratosValidos(p, contratos, id).length > 0);
  const todos: EquipoSugerido[] = [];
  for (const a of con) todos.push({ equipo: [{ empresaId: a, pct: 100 }], resultado: evaluarEquipoInterventoria(p, [{ empresaId: a, pct: 100 }], contratos) });
  for (const a of con) for (const b of con) {
    if (a === b) continue;
    const equipo = [{ empresaId: a, pct: 60 }, { empresaId: b, pct: 40 }];
    todos.push({ equipo, resultado: evaluarEquipoInterventoria(p, equipo, contratos) });
  }
  return todos
    .sort((x, y) => y.resultado.puntaje - x.resultado.puntaje || x.equipo.length - y.equipo.length || y.resultado.acreditado - x.resultado.acreditado)
    .slice(0, limite);
}

const T_METAL = "tuberia_metalica_presion";
const BASE = { maxContratos: 4, ventanaAnios: 30, todosAportan: true, mayorValorPct: 50, aceptaConsultoria: false } as const;

/**
 * Perfiles de partida; los números salen de la solicitud de contratación de cada interventoría (mayo de 2026) o, en los
 * de referencia, de las condiciones específicas. Las reglas de oferta plural (todos aportan, el mayor aporta 50 % del valor)
 * se tomaron de la invitación ICSM-1315-2024: confírmalas en las condiciones generales de cada proceso.
 */
export const PERFILES_BASE: PerfilInterventoria[] = [
  {
    ...BASE,
    nombre: "Interventoría · Línea de refuerzo Avenida Cundinamarca (DM-2011-003)",
    poPesos: 1047090124,
    smlmv: 1750905,
    porcentajePO: 100,
    fechaCierre: "2026-12-01",
    criterios: [
      { etiqueta: T_METAL, texto: "Act. 1: interventoría de tubería metálica a presión ≥ 12\" en más de 1.160 m" },
      { etiqueta: "sin_zanja", texto: "Act. 2: interventoría de tubería a presión ≥ 12\" sin zanja en más de 30 m" },
      { etiqueta: "camaras_acueducto", texto: "Act. 3: interventoría de cámaras de acueducto (redes > 12\") con ≥ 160 m³ de concreto" },
    ],
  },
  {
    ...BASE,
    nombre: "Interventoría · Línea de refuerzo sector S-01 Bosa (DM-1007-006)",
    poPesos: 2999683806,
    smlmv: 1750905,
    porcentajePO: 90,
    fechaCierre: "2026-12-01",
    criterios: [
      { etiqueta: T_METAL, texto: "Act. 1: interventoría de tubería metálica a presión ≥ 24\" a cielo abierto en 1.350 m o más" },
      { etiqueta: "sin_zanja", texto: "Act. 2: interventoría de tubería a presión ≥ 24\" sin zanja en más de 331 m" },
      { etiqueta: "camaras_acueducto", texto: "Act. 3: interventoría de cámaras de acueducto (redes > 24\") con ≥ 240 m³ de concreto" },
    ],
  },
  {
    ...BASE,
    nombre: "Interventoría · Apoyo a mantenimiento de red matriz (DM-6055-050) · PRESUPUESTO EN BLANCO, VALOR DE PRUEBA",
    poPesos: 4000000000,
    smlmv: 1750905,
    porcentajePO: 80,
    fechaCierre: "2026-12-01",
    criterios: [
      { etiqueta: T_METAL, tambien: ["reparacion_danos"], texto: "Act. 1: interventoría de tubería metálica ≥ 24\" en 3.000 m o más, o de 81 reparaciones de daños ≥ 24\"" },
      { etiqueta: "estructuras_concreto", texto: "Act. 2: interventoría de estructuras de concreto reforzado ≥ 500 m³" },
      { etiqueta: "pavimento", texto: "Act. 3: interventoría de pavimento rígido o flexible ≥ 314 m³ (o 2.617 m²)" },
    ],
  },
  {
    ...BASE,
    nombre: "ICSM-1315-2024 · interceptores Fucha–Tunjuelo (referencia, ya cerrada)",
    poPesos: 484264868,
    smlmv: 1300000,
    porcentajePO: 100,
    fechaCierre: "2024-08-15",
    criterios: [
      { etiqueta: "limpieza_redes", texto: "Interventoría con limpieza de redes de alcantarillado (≥ 2.776 m³ o redes ≥ 24\")" },
      { etiqueta: "bombeo", texto: "Interventoría con evacuación por bombeo (≥ 8.500 m³)" },
    ],
  },
  {
    ...BASE,
    nombre: "Genérica · solo el valor (100 % del presupuesto)",
    poPesos: 2000000000,
    smlmv: 1750905,
    porcentajePO: 100,
    fechaCierre: "2026-12-01",
    criterios: [],
  },
];
