import type { CriterioActividad, RequisitosFinancierosEstructurado } from "@/lib/types";

/**
 * Piezas puras de la evaluación de la EAAB (sin acceso a la base de datos), para poder usarlas tanto en la
 * calificación como en el simulador de consorcios del navegador.
 */

export const MET = /hierro d|d[uú]ctil|\bHD\b|acero|\bAC\b|WSP|CCP|PCCP|cilindro/i;

export const unidadNormal = (u: string): string => {
  const x = u.toLowerCase().replace(/\./g, "").trim();
  if (["m", "ml", "mts", "mt", "metro", "metros", "metros lineales"].includes(x)) return "m";
  if (["m3", "m³"].includes(x)) return "m3";
  if (["m2", "m²"].includes(x)) return "m2";
  if (["un", "und", "unidad", "unidades"].includes(x)) return "un";
  return x;
};

export interface ActividadExtraida {
  descripcion: string;
  cantidad: number;
  unidad: string;
  categoria?: string;
  material?: string;
  diametro_pulgadas?: number;
  metodo_instalacion?: string;
  /** «contratada» o «diseño»: la cantidad sale de la minuta o del presupuesto de un diseño, no de lo ejecutado; no se acredita. */
  fuente?: string;
}

export function cumpleCriterio(a: ActividadExtraida, c: CriterioActividad): boolean {
  if (a.categoria !== c.categoria) return false;
  if (unidadNormal(a.unidad) !== c.unidad) return false;
  if (c.diametro_min_pulgadas != null && (a.diametro_pulgadas ?? 0) < c.diametro_min_pulgadas) return false;
  if (c.metodo === "sin_zanja" && a.metodo_instalacion !== "sin_zanja") return false;
  if (c.metodo === "cielo_abierto" && a.metodo_instalacion === "sin_zanja") return false;
  if (c.metalica && !MET.test(`${a.material ?? ""} ${a.descripcion}`)) return false;
  if (c.descripcion_regex) {
    if (!new RegExp(c.descripcion_regex, "i").test(a.descripcion)) return false;
    // Los criterios con descripción piden cámaras o cajas de acueducto: las de alcantarillado (pozos, sumideros, cámaras de caída) no cuentan.
    if (/alcantarill|pluvial|sanitari|sumidero|\bpozo/i.test(a.descripcion)) return false;
    // Tanques, reservorios, pondajes, box culverts y canales no son cámaras de redes de acueducto.
    if (/tanque|reservorio|pondaje|box[\s-]*culvert|\bcanal/i.test(a.descripcion)) return false;
  }
  return true;
}

const ES_DEMOLICION = /demolici|rotura|remoci[oó]n|retiro|desmonte/i;
const ES_TOTAL = /\btotal\b|consolidado|acumulado/i;

/**
 * Cantidad que un contrato acredita para un criterio. Las extracciones traen líneas que no suman: demoliciones o retiros
 * (no son construcción), el mismo volumen registrado como «suministro» y como «instalación», y líneas de «total» que
 * repiten las parciales. Aquí se descartan las demoliciones, se cuenta una sola vez cada cantidad repetida y, si hay líneas
 * parciales, se ignoran las de «total».
 */
export function cantidadAcreditada(actividades: ActividadExtraida[], c: CriterioActividad, contextoContrato?: string | null, participacionPct?: number | null): number {
  // Un criterio de cámaras de acueducto no se acredita con las cajas o cámaras de un contrato de alcantarillado: se mira el
  // sector y el objeto del contrato, y la descripción de cada actividad.
  // «Acueducto de Bogotá» o «Acueducto y Alcantarillado de Bogotá» es el nombre de la entidad, no una obra de acueducto.
  const ctx = (contextoContrato ?? "").replace(/acueducto(,| y)?( alcantarillado)?( y aseo)? de bogot[aá]/gi, "");
  const contratoDeAlcantarillado = c.descripcion_regex != null && /alcantarill|pluvial|sanitari|interceptor|colector|\bcanal|box[\s-]*culvert|tanque|talud/i.test(ctx) && !/acueducto/i.test(ctx);
  const candidatas = actividades.filter((a) => !["contratada", "diseño"].includes(a.fuente ?? "") && cumpleCriterio(a, c) && !ES_DEMOLICION.test(a.descripcion) && !(contratoDeAlcantarillado && !/acueducto/i.test(a.descripcion)));
  const parciales = candidatas.filter((a) => !ES_TOTAL.test(a.descripcion));
  const usadas = parciales.length ? parciales : candidatas;
  const vistas = new Set<string>();
  let suma = 0;
  for (const a of usadas) {
    const cantidad = Number(a.cantidad) || 0;
    const clave = `${a.categoria}|${unidadNormal(a.unidad)}|${cantidad.toFixed(1)}|${a.diametro_pulgadas ?? ""}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    suma += cantidad;
  }
  // En consorcios y uniones temporales la actividad certificada cuenta en proporción a la participación del integrante.
  return suma * ((participacionPct ?? 100) / 100);
}

export function textoCriterio(c: CriterioActividad): string {
  const partes = [c.categoria.replace(/_/g, " ")];
  if (c.metalica) partes.push("metálica");
  if (c.diametro_min_pulgadas) partes.push(`≥ ${c.diametro_min_pulgadas}"`);
  if (c.metodo) partes.push(c.metodo === "sin_zanja" ? "sin zanja" : "a cielo abierto");
  return `${partes.join(" ")} ${c.estricto ? ">" : "≥"} ${c.minimo.toLocaleString("es-CO")} ${c.unidad}`;
}


export function umbrales(req: RequisitosFinancierosEstructurado | null) {
  const busca = (campo: string) => req?.indicadores.find((i) => i.campo_base === campo);
  const minimo = (campo: string) => busca(campo)?.tramos.find((t) => t.puntos > 0)?.min ?? null;
  const maximo = (campo: string) => busca(campo)?.tramos.find((t) => t.puntos > 0)?.max ?? null;
  const endeud = maximo("indice_endeudamiento");
  const roe = minimo("rentabilidad_patrimonio");
  const roa = minimo("rentabilidad_activo");
  return {
    liquidez: minimo("indice_liquidez"),
    endeudamiento: endeud != null ? Math.floor(endeud) / 100 : null,
    cobertura: minimo("razon_cobertura_intereses"),
    capitalTrabajo: minimo("ctn"),
    patrimonio: minimo("patrimonio"),
    roe: roe != null ? roe / 100 : null,
    roa: roa != null ? roa / 100 : null,
  };
}
