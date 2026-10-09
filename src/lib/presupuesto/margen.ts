import type { PresupuestoItem } from "@/lib/types";

/**
 * Supuestos del análisis de margen y flujo de caja. Los defaults salen de las solicitudes de la EAAB:
 * pago a 30 días de la radicación, retención en garantía del 6% (3% al recibo final y 3% a la
 * liquidación), anticipo del 20% amortizado como mínimo 20% de cada acta.
 */
export interface Supuestos {
  /** Promedio de los precios unitarios ofertados sobre el oficial (la EAAB exige entre 0,90 y 1,00 por ítem). */
  porcentaje_oferta: number;
  /** Costo directo de los ítems sin costo cargado, como fracción del precio oficial. Es un supuesto, no una cotización. */
  costo_default_pct: number;
  admin_ofertada_pct: number;
  utilidad_ofertada_pct: number;
  imprevistos_pct: number;
  admin_suministro_pct: number;
  admin_movilidad_pct: number;
  /** Valor global fijo de impacto urbano (no ofertable). */
  impacto_urbano: number;
  costo_impacto_pct: number;
  /** Costo real de administración de la obra, como % del costo directo de obra y movilidad. */
  indirectos_reales_pct: number;
  plazo_meses: number;
  anticipo_pct: number;
  retencion_pct: number;
  amortizacion_pct: number;
  /** Días entre el cierre del mes de obra y el pago de la EAAB (radicación + 30 días). */
  dias_cobro: number;
  /** Meses entre el recibo final y la liquidación, cuando se devuelve la segunda mitad de la retención. */
  meses_liquidacion: number;
  pct_costos_credito: number;
  meses_credito: number;
  /** Parte del costo que son compras de materiales y suministros, la única que puede pagarse con el anticipo. */
  pct_costos_anticipable: number;
  curva: "s" | "lineal";
  costo_financiero_anual_pct: number;
  costo_polizas_pct: number;
}

export const SUPUESTOS_BASE: Supuestos = {
  porcentaje_oferta: 0.95,
  costo_default_pct: 0.9,
  admin_ofertada_pct: 27.74,
  utilidad_ofertada_pct: 5,
  imprevistos_pct: 1,
  admin_suministro_pct: 15.51,
  admin_movilidad_pct: 27.74,
  impacto_urbano: 0,
  costo_impacto_pct: 1,
  indirectos_reales_pct: 27.74,
  plazo_meses: 12,
  anticipo_pct: 20,
  retencion_pct: 6,
  amortizacion_pct: 20,
  dias_cobro: 45,
  meses_liquidacion: 4,
  pct_costos_credito: 0.5,
  meses_credito: 1,
  pct_costos_anticipable: 0.5,
  curva: "s",
  costo_financiero_anual_pct: 18,
  costo_polizas_pct: 1.2,
};

export function completarSupuestos(parcial?: Partial<Supuestos> | null): Supuestos {
  return { ...SUPUESTOS_BASE, ...(parcial ?? {}) };
}

const num = (n: number | null | undefined) => n ?? 0;

export interface FilaFlujo {
  mes: number;
  avancePct: number;
  actaBruta: number;
  anticipo: number;
  amortizacion: number;
  retencion: number;
  devolucionRetencion: number;
  cobro: number;
  costosCausados: number;
  pagoCostos: number;
  /** Pagos de materiales financiados con el anticipo (que está en un encargo fiduciario y no es caja libre). */
  usoAnticipo: number;
  saldoAnticipo: number;
  neto: number;
  acumulado: number;
}

export interface ResultadoFlujo {
  filas: FilaFlujo[];
  necesidadMaxima: number;
  mesNecesidadMaxima: number;
  costoFinanciero: number;
  /** Mes desde el cual el acumulado deja de ser negativo, si llega a serlo. */
  mesRecuperacion: number | null;
}

function curvaAvance(n: number, tipo: "s" | "lineal"): number[] {
  const F = (x: number) => (tipo === "s" ? 3 * x * x - 2 * x * x * x : x);
  return Array.from({ length: n }, (_, i) => F((i + 1) / n) - F(i / n));
}

export function calcularFlujo(ingresoContrato: number, costoTotal: number, s: Supuestos): ResultadoFlujo {
  const n = Math.max(1, Math.round(s.plazo_meses));
  const avance = curvaAvance(n, s.curva);
  const rezagoCobro = Math.max(0, Math.ceil(s.dias_cobro / 30));
  const horizonte = n + Math.max(rezagoCobro, s.meses_liquidacion + rezagoCobro, s.meses_credito) + 1;

  const filas: FilaFlujo[] = Array.from({ length: horizonte + 1 }, (_, mes) => ({
    mes,
    avancePct: 0,
    actaBruta: 0,
    anticipo: 0,
    amortizacion: 0,
    retencion: 0,
    devolucionRetencion: 0,
    cobro: 0,
    costosCausados: 0,
    pagoCostos: 0,
    usoAnticipo: 0,
    saldoAnticipo: 0,
    neto: 0,
    acumulado: 0,
  }));

  filas[0].anticipo = (s.anticipo_pct / 100) * ingresoContrato;

  for (let t = 1; t <= n; t++) {
    const acta = ingresoContrato * avance[t - 1];
    const f = filas[t];
    f.avancePct = avance[t - 1] * 100;
    f.actaBruta = acta;
    f.amortizacion = (s.amortizacion_pct / 100) * acta;
    f.retencion = (s.retencion_pct / 100) * acta;
    const cobrable = acta - f.amortizacion - f.retencion;
    const mesCobro = Math.min(horizonte, t + rezagoCobro);
    filas[mesCobro].cobro += cobrable;

    const costo = costoTotal * avance[t - 1];
    f.costosCausados = costo;
    filas[t].pagoCostos += costo * (1 - s.pct_costos_credito);
    filas[Math.min(horizonte, t + s.meses_credito)].pagoCostos += costo * s.pct_costos_credito;
  }

  const retenidoTotal = (s.retencion_pct / 100) * ingresoContrato;
  filas[Math.min(horizonte, n + rezagoCobro)].devolucionRetencion += retenidoTotal / 2;
  filas[Math.min(horizonte, n + s.meses_liquidacion + rezagoCobro)].devolucionRetencion += retenidoTotal / 2;

  let acumulado = 0;
  let necesidadMaxima = 0;
  let mesNecesidadMaxima = 0;
  let costoFinanciero = 0;
  let saldoAnticipo = 0;
  const tasaMensual = s.costo_financiero_anual_pct / 100 / 12;
  for (const f of filas) {
    saldoAnticipo += f.anticipo;
    // El anticipo solo puede pagar materiales; lo demás sale de caja propia o de financiación.
    const materiales = f.pagoCostos * s.pct_costos_anticipable;
    f.usoAnticipo = Math.min(saldoAnticipo, materiales);
    saldoAnticipo -= f.usoAnticipo;
    f.saldoAnticipo = saldoAnticipo;
    f.neto = f.cobro + f.devolucionRetencion - (f.pagoCostos - f.usoAnticipo);
    acumulado += f.neto;
    f.acumulado = acumulado;
    if (acumulado < necesidadMaxima) {
      necesidadMaxima = acumulado;
      mesNecesidadMaxima = f.mes;
    }
    if (acumulado < 0) costoFinanciero += -acumulado * tasaMensual;
  }

  let mesRecuperacion: number | null = null;
  if (necesidadMaxima < 0) {
    for (const f of filas) {
      if (f.mes > mesNecesidadMaxima && f.acumulado >= 0) {
        mesRecuperacion = f.mes;
        break;
      }
    }
  }

  return { filas, necesidadMaxima: Math.max(0, -necesidadMaxima), mesNecesidadMaxima, costoFinanciero, mesRecuperacion };
}

export interface ResultadoMargen {
  ingresoObra: number;
  ingresoSuministro: number;
  ingresoMovilidad: number;
  ingresoTotal: number;
  costoDirecto: number;
  costoDirectoObra: number;
  costoIndirecto: number;
  costoImpacto: number;
  costoPolizas: number;
  costoFinanciero: number;
  utilidad: number;
  margenPct: number;
  /** Fracción del costo directo que viene de un costo cargado (cotización o estimación propia), no del supuesto general. */
  coberturaCostos: number;
  puntoEquilibrio: number;
  flujo: ResultadoFlujo;
}

/**
 * Los precios oficiales son costo directo; la administración, imprevistos y utilidad se calculan
 * sobre el subtotal ofertado. Suministros y movilidad llevan su propia administración.
 */
export function calcularMargen(items: PresupuestoItem[], s: Supuestos, f = s.porcentaje_oferta): ResultadoMargen {
  const total = (sec: string) =>
    items.filter((i) => i.seccion === sec).reduce((a, i) => a + num(i.total), 0);
  const doObra = total("obra");
  const doSum = total("suministro");
  const doMov = total("movilidad");

  const K =
    doObra * (1 + (s.admin_ofertada_pct + s.imprevistos_pct + s.utilidad_ofertada_pct) / 100) +
    doSum * (1 + s.admin_suministro_pct / 100) +
    doMov * (1 + s.admin_movilidad_pct / 100);
  const ingresoObra = doObra * f * (1 + (s.admin_ofertada_pct + s.imprevistos_pct + s.utilidad_ofertada_pct) / 100);
  const ingresoSuministro = doSum * f * (1 + s.admin_suministro_pct / 100);
  const ingresoMovilidad = doMov * f * (1 + s.admin_movilidad_pct / 100);
  const ingresoTotal = ingresoObra + ingresoSuministro + ingresoMovilidad + s.impacto_urbano;

  let costoDirecto = 0;
  let costoDirectoObra = 0;
  let costoCargado = 0;
  for (const i of items) {
    const cantidad = num(i.cantidad);
    const conCosto = i.costo_unitario != null;
    const unit = conCosto ? (i.costo_unitario as number) : num(i.precio_unitario) * s.costo_default_pct;
    const c = unit * cantidad;
    costoDirecto += c;
    if (conCosto) costoCargado += c;
    if (i.seccion === "obra" || i.seccion === "movilidad") costoDirectoObra += c;
  }
  const costoIndirecto = (s.indirectos_reales_pct / 100) * costoDirectoObra;
  const costoImpacto = s.impacto_urbano * s.costo_impacto_pct;
  const costoOperativo = costoDirecto + costoIndirecto + costoImpacto;
  const costoPolizas = (s.costo_polizas_pct / 100) * ingresoTotal;

  const flujo = calcularFlujo(ingresoTotal, costoOperativo, s);
  const utilidad = ingresoTotal - costoOperativo - costoPolizas - flujo.costoFinanciero;

  // Punto de equilibrio: porcentaje de oferta con el que la utilidad es cero (costos financieros y pólizas del caso actual).
  const denom = K;
  const puntoEquilibrio =
    denom > 0
      ? ((costoOperativo + flujo.costoFinanciero) / (1 - s.costo_polizas_pct / 100) - s.impacto_urbano) / denom
      : 0;

  return {
    ingresoObra,
    ingresoSuministro,
    ingresoMovilidad,
    ingresoTotal,
    costoDirecto,
    costoDirectoObra,
    costoIndirecto,
    costoImpacto,
    costoPolizas,
    costoFinanciero: flujo.costoFinanciero,
    utilidad,
    margenPct: ingresoTotal ? (utilidad / ingresoTotal) * 100 : 0,
    coberturaCostos: costoDirecto ? costoCargado / costoDirecto : 0,
    puntoEquilibrio,
    flujo,
  };
}

export const NIVELES_OFERTA = [0.9, 0.925, 0.95, 0.975, 1];

/** Supuestos iniciales tomados del resumen oficial del presupuesto (AIU, administración de suministro y movilidad, impacto urbano, plazo). */
export function supuestosDesdeResumen(resumen: {
  lineas?: { etiqueta: string; valor: number; porcentaje?: number }[];
  plazo_meses?: number;
} | null | undefined): Supuestos {
  const s = { ...SUPUESTOS_BASE };
  const lineas = resumen?.lineas ?? [];
  const pctDe = (re: RegExp) => lineas.find((l) => re.test(l.etiqueta) && l.porcentaje != null)?.porcentaje;
  const valorDe = (re: RegExp) => lineas.find((l) => re.test(l.etiqueta))?.valor;

  const admin = pctDe(/^administraci[oó]n$/i);
  if (admin != null) {
    s.admin_ofertada_pct = admin;
    s.indirectos_reales_pct = admin;
  }
  const imprev = pctDe(/^imprevistos$/i);
  if (imprev != null) s.imprevistos_pct = imprev;
  const util = pctDe(/^utilidad$/i);
  if (util != null) s.utilidad_ofertada_pct = util;
  const adminSum = pctDe(/administraci[oó]n de suministro/i);
  if (adminSum != null) s.admin_suministro_pct = adminSum;
  const adminMov = pctDe(/administraci[oó]n de movilidad/i);
  s.admin_movilidad_pct = adminMov ?? admin ?? s.admin_movilidad_pct;
  const impacto = valorDe(/impacto urbano/i);
  if (impacto != null) s.impacto_urbano = impacto;
  if (resumen?.plazo_meses) s.plazo_meses = resumen.plazo_meses;
  return s;
}
