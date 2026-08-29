import type { IndicadorFinancieroRequisito, RequisitosFinancierosEstructurado } from "@/lib/types";
import type { IndicadorFinancieroInput, ResultadoFinancieroAnio, ResultadoIndicador } from "./tipos";

const CAMPOS_SUMABLES = [
  "patrimonio",
  "capital_trabajo",
  "activo_corriente",
  "pasivo_corriente",
  "activo_total",
  "pasivo_total",
  "utilidad_operacional",
  "gastos_financieros",
  "efectivo_generado_operacion",
  "efectivo_y_equivalentes",
  "deuda_financiera",
] as const;

type CampoSumable = (typeof CAMPOS_SUMABLES)[number];
type BaseContableCombinada = Record<CampoSumable, number | null>;

/**
 * Suma ponderada de las cuentas contables base (no de los ratios ya calculados) según el %
 * de participación de cada empresa. Esta es la misma fórmula que ya estaba escrita como
 * instrucción de prompt en verificarCumplimiento.ts, ahora como código determinístico: si a
 * alguna empresa le falta un campo base, ese campo queda en null en el resultado (no se
 * aproxima con 0, para no inflar/desinflar el indicador).
 */
export function combinarBaseContable(
  indicadores: { indicador: IndicadorFinancieroInput; pct: number }[],
): BaseContableCombinada {
  const resultado = {} as BaseContableCombinada;
  for (const campo of CAMPOS_SUMABLES) {
    let suma = 0;
    let faltaAlguno = false;
    for (const { indicador, pct } of indicadores) {
      const valor = indicador[campo];
      if (valor == null) {
        faltaAlguno = true;
        break;
      }
      suma += valor * (pct / 100);
    }
    resultado[campo] = faltaAlguno ? null : suma;
  }
  return resultado;
}

function dividir(numerador: number | null, denominador: number | null): number | null {
  if (numerador == null || denominador == null || denominador === 0) return null;
  return numerador / denominador;
}

const CAMPOS_RATIO_DIRECTOS = [
  "indice_liquidez",
  "indice_endeudamiento",
  "rentabilidad_patrimonio",
  "rentabilidad_activo",
  "razon_cobertura_intereses",
] as const;

/**
 * Cuando solo hay UNA empresa en la evaluación (no un consorcio), un ratio ya calculado y
 * guardado directamente (ej. extraído del RUP, sin las cuentas base como utilidad operacional)
 * sigue siendo válido — no hay nada que combinar. Solo se usa como respaldo cuando el cálculo
 * a partir de la base contable no fue posible por falta de datos; si SÍ hay más de una empresa,
 * nunca se usa (habría que promediar ratios individuales, que es exactamente lo que el pliego
 * prohíbe).
 */
function valorRatioDirectoSiUnaEmpresa(
  campo: string | undefined,
  indicadoresPorEmpresa: { indicador: IndicadorFinancieroInput; pct: number }[],
): number | null {
  if (indicadoresPorEmpresa.length !== 1 || !campo) return null;
  if (!(CAMPOS_RATIO_DIRECTOS as readonly string[]).includes(campo)) return null;
  const valor = indicadoresPorEmpresa[0].indicador[campo as (typeof CAMPOS_RATIO_DIRECTOS)[number]];
  return valor ?? null;
}

/**
 * Resuelve el valor numérico de un indicador a partir de la base contable ya combinada.
 * Si `campo_base` coincide con una fórmula conocida (ratios estándar), se calcula a partir de
 * los componentes base combinados — nunca promediando ratios individuales ya calculados. Si el
 * cálculo desde la base no es posible (faltan cuentas) y solo hay una empresa, se usa como
 * respaldo el ratio ya guardado directamente (ver `valorRatioDirectoSiUnaEmpresa`).
 */
export function resolverValorIndicador(
  regla: IndicadorFinancieroRequisito,
  base: BaseContableCombinada,
  indicadoresPorEmpresa: { indicador: IndicadorFinancieroInput; pct: number }[] = [],
): number | null {
  const campo = regla.campo_base?.trim().toLowerCase();
  const calculado = resolverDesdeBase(campo, base);
  return calculado ?? valorRatioDirectoSiUnaEmpresa(campo, indicadoresPorEmpresa);
}

function resolverDesdeBase(campo: string | undefined, base: BaseContableCombinada): number | null {
  switch (campo) {
    case "patrimonio":
    case "capital_trabajo":
    case "activo_corriente":
    case "pasivo_corriente":
    case "activo_total":
    case "pasivo_total":
    case "utilidad_operacional":
    case "gastos_financieros":
    case "efectivo_generado_operacion":
    case "efectivo_y_equivalentes":
    case "deuda_financiera":
      return base[campo];
    case "ctn":
    case "capital_de_trabajo_neto":
      return base.capital_trabajo ?? dividir(
        base.activo_corriente != null && base.pasivo_corriente != null
          ? base.activo_corriente - base.pasivo_corriente
          : null,
        1,
      );
    case "indice_liquidez":
    case "liquidez":
      return dividir(base.activo_corriente, base.pasivo_corriente);
    case "indice_endeudamiento":
    case "endeudamiento":
    case "ie":
      return dividir(base.pasivo_total, base.activo_total) != null
        ? (dividir(base.pasivo_total, base.activo_total) as number) * 100
        : null;
    case "rentabilidad_patrimonio":
    case "roe":
      return dividir(base.utilidad_operacional, base.patrimonio) != null
        ? (dividir(base.utilidad_operacional, base.patrimonio) as number) * 100
        : null;
    case "rentabilidad_activo":
    case "roa":
      return dividir(base.utilidad_operacional, base.activo_total) != null
        ? (dividir(base.utilidad_operacional, base.activo_total) as number) * 100
        : null;
    case "razon_cobertura_intereses":
    case "cobertura_intereses":
    case "ci":
      return dividir(base.efectivo_generado_operacion, base.gastos_financieros);
    case "multiplo_deuda_neta":
    case "mdn": {
      if (base.deuda_financiera == null || base.efectivo_y_equivalentes == null) return null;
      const deudaNeta = base.deuda_financiera - base.efectivo_y_equivalentes;
      if (deudaNeta <= 0) return 0; // deuda neta negativa o cero -> mejor caso posible (0 = puntaje máximo típico)
      return dividir(deudaNeta, base.efectivo_generado_operacion);
    }
    default:
      // Fórmula compuesta libre (regla.formula) sin campo_base reconocido: no se puede
      // calcular determinísticamente. Se marca como no disponible en vez de adivinar.
      return null;
  }
}

export function puntuarIndicador(valor: number | null, regla: IndicadorFinancieroRequisito): ResultadoIndicador {
  if (valor == null) {
    return { nombre: regla.nombre, valor: null, puntos: 0, tramo: null };
  }
  const tramo = regla.tramos.find((t) => {
    const minOk = t.min == null || valor >= t.min;
    const maxOk = t.max == null || valor < t.max;
    return minOk && maxOk;
  });
  return { nombre: regla.nombre, valor, puntos: tramo?.puntos ?? 0, tramo: tramo ?? null };
}

export function scoreRequisitosFinancierosAnio(
  indicadoresPorEmpresa: { indicador: IndicadorFinancieroInput; pct: number }[],
  requisitos: RequisitosFinancierosEstructurado,
  periodo: string,
): ResultadoFinancieroAnio {
  const base = combinarBaseContable(indicadoresPorEmpresa);
  const detalle = requisitos.indicadores.map((regla) =>
    puntuarIndicador(resolverValorIndicador(regla, base, indicadoresPorEmpresa), regla),
  );
  const puntajeTotal = detalle.reduce((sum, r) => sum + r.puntos, 0);
  const cumple = requisitos.puntaje_minimo_total == null || puntajeTotal >= requisitos.puntaje_minimo_total;
  return { periodo, puntajeTotal, detalle, cumple };
}

/**
 * Evalúa todos los períodos exigidos por el pliego (`anios_evaluados`) para un conjunto de
 * empresas ya ponderadas por %. Si `modo_evaluacion` es "por_año", el conjunto solo cumple si
 * TODOS los años evaluados cumplen individualmente (no un promedio).
 */
export function scoreRequisitosFinancierosPorAnio(
  indicadoresPorAnioPorEmpresa: Map<string, { indicador: IndicadorFinancieroInput; pct: number }[]>,
  requisitos: RequisitosFinancierosEstructurado,
): ResultadoFinancieroAnio[] {
  const periodos = [...indicadoresPorAnioPorEmpresa.keys()].sort((a, b) => b.localeCompare(a));
  const relevantes =
    requisitos.anios_evaluados != null ? periodos.slice(0, requisitos.anios_evaluados) : periodos.slice(0, 1);

  return relevantes.map((periodo) =>
    scoreRequisitosFinancierosAnio(indicadoresPorAnioPorEmpresa.get(periodo) ?? [], requisitos, periodo),
  );
}
