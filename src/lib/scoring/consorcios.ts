import type { RequisitosFinancierosEstructurado, RequisitosTecnicosEstructurado } from "@/lib/types";
import { scoreRequisitosFinancierosPorAnio } from "./financiero";
import { evaluarExperienciaEmpresa } from "./tecnico";
import type {
  EmpresaScoringInput,
  GrupoConsorcioSugerido,
  IndicadorFinancieroInput,
  ResultadoEmpresaIndividual,
  ResultadoFinancieroAnio,
} from "./tipos";

const PISO_PARTICIPACION_PCT = 5;
const PASOS_AJUSTE = 40;

export function evaluarEmpresaIndividual(
  input: EmpresaScoringInput,
  requisitosFinancieros: RequisitosFinancierosEstructurado,
  requisitosTecnicos: RequisitosTecnicosEstructurado,
  hoy: Date = new Date(),
): ResultadoEmpresaIndividual {
  const tecnico = evaluarExperienciaEmpresa(input.experiencia, requisitosTecnicos, hoy);

  const porAnio = new Map<string, { indicador: IndicadorFinancieroInput; pct: number }[]>();
  for (const [periodo, indicador] of input.indicadoresPorAnio) {
    porAnio.set(periodo, [{ indicador, pct: 100 }]);
  }
  const financiero = scoreRequisitosFinancierosPorAnio(porAnio, requisitosFinancieros);

  const cumpleTecnico = tecnico.cumpleMinimo;
  const cumpleFinanciero = financiero.length > 0 && financiero.every((f) => f.cumple);
  const sinDatos = input.indicadoresPorAnio.size === 0 && input.experiencia.length === 0;

  return {
    empresaId: input.empresaId,
    nombre: input.nombre,
    tecnico,
    financiero,
    cumpleTecnico,
    cumpleFinanciero,
    veredicto: sinDatos ? "sin_datos" : cumpleTecnico && cumpleFinanciero ? "cumple" : "no_cumple",
  };
}

function combinacionesDeTamano<T>(items: T[], tamano: number): T[][] {
  if (tamano === 0) return [[]];
  if (tamano > items.length) return [];
  const [primero, ...resto] = items;
  const conPrimero = combinacionesDeTamano(resto, tamano - 1).map((c) => [primero, ...c]);
  const sinPrimero = combinacionesDeTamano(resto, tamano);
  return [...conPrimero, ...sinPrimero];
}

/** Genera todas las combinaciones de empresas de tamaño minTamano..maxTamano (N pequeño, sin necesidad de optimizador). */
function generarGrupos(empresas: EmpresaScoringInput[], minTamano: number, maxTamano: number): EmpresaScoringInput[][] {
  const grupos: EmpresaScoringInput[][] = [];
  for (let n = minTamano; n <= Math.min(maxTamano, empresas.length); n++) {
    grupos.push(...combinacionesDeTamano(empresas, n));
  }
  return grupos;
}

function experienciaPonderada(
  valoresPropios: number[],
  pcts: number[],
): number {
  return valoresPropios.reduce((sum, v, i) => sum + v * (pcts[i] / 100), 0);
}

function evaluarFinancieroConPcts(
  empresas: EmpresaScoringInput[],
  pcts: number[],
  requisitosFinancieros: RequisitosFinancierosEstructurado,
): ResultadoFinancieroAnio[] {
  const periodos = new Set<string>();
  empresas.forEach((e) => e.indicadoresPorAnio.forEach((_, p) => periodos.add(p)));

  const porAnio = new Map<string, { indicador: IndicadorFinancieroInput; pct: number }[]>();
  for (const periodo of periodos) {
    const lista = empresas
      .map((e, i) => {
        const indicador = e.indicadoresPorAnio.get(periodo);
        return indicador ? { indicador, pct: pcts[i] } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (lista.length === empresas.length) porAnio.set(periodo, lista);
  }
  return scoreRequisitosFinancierosPorAnio(porAnio, requisitosFinancieros);
}

/**
 * Busca una asignación de % de participación factible para un grupo fijo de empresas.
 * No es un optimizador exacto (con N empresas hay N-1 grados de libertad reales) sino una
 * búsqueda local acotada: parte de una asignación proporcional al valor de experiencia propio
 * de cada integrante (con un piso mínimo por integrante), y si el financiero no alcanza el
 * puntaje mínimo, desplaza participación por pasos desde el integrante financieramente más
 * débil hacia el más fuerte, siempre que la experiencia ponderada se mantenga sobre el umbral.
 */
export function asignarParticipacionFactible(
  grupo: EmpresaScoringInput[],
  requisitosFinancieros: RequisitosFinancierosEstructurado,
  requisitosTecnicos: RequisitosTecnicosEstructurado,
  hoy: Date = new Date(),
): GrupoConsorcioSugerido {
  const n = grupo.length;
  const nombres = grupo.map((e) => e.nombre);

  const resultadosTecnicos = grupo.map((e) => evaluarExperienciaEmpresa(e.experiencia, requisitosTecnicos, hoy));
  const valoresPropios = resultadosTecnicos.map((r) => r.valorSmmlvElegible);

  if (requisitosTecnicos.min_contratos_por_integrante) {
    const sinContrato = resultadosTecnicos
      .map((r, i) => (r.contratosElegibles.length === 0 ? nombres[i] : null))
      .filter((n): n is string => n !== null);
    if (sinContrato.length > 0) {
      return {
        integrantes: grupo.map((e, i) => ({ empresaId: e.empresaId, nombre: e.nombre, porcentaje: 0 })),
        experienciaResultanteSmmlv: 0,
        financieroResultantePorAnio: [],
        factible: false,
        motivoNoFactible: `${sinContrato.join(", ")} no ${sinContrato.length === 1 ? "aporta" : "aportan"} ningún contrato propio elegible, y el pliego exige mínimo 1 por integrante.`,
      };
    }
  }

  const pisoTotal = PISO_PARTICIPACION_PCT * n;
  if (pisoTotal >= 100) {
    return {
      integrantes: grupo.map((e) => ({ empresaId: e.empresaId, nombre: e.nombre, porcentaje: Math.floor(100 / n) })),
      experienciaResultanteSmmlv: 0,
      financieroResultantePorAnio: [],
      factible: false,
      motivoNoFactible: "Demasiados integrantes para repartir una participación mínima razonable.",
    };
  }

  const sumaValores = valoresPropios.reduce((a, b) => a + b, 0);
  let pcts =
    sumaValores > 0
      ? valoresPropios.map((v) => PISO_PARTICIPACION_PCT + (v / sumaValores) * (100 - pisoTotal))
      : grupo.map(() => 100 / n);

  const umbral = requisitosTecnicos.valor_minimo_acumulado_smmlv ?? 0;

  // Si aun concentrando el máximo posible en el integrante con más experiencia no se llega al
  // umbral, el grupo es infactible en el eje de experiencia sin importar el eje financiero.
  const maxPosibleIdx = valoresPropios.indexOf(Math.max(...valoresPropios));
  const pctsMaxExperiencia = grupo.map((_, i) =>
    i === maxPosibleIdx ? 100 - PISO_PARTICIPACION_PCT * (n - 1) : PISO_PARTICIPACION_PCT,
  );
  if (experienciaPonderada(valoresPropios, pctsMaxExperiencia) < umbral) {
    return {
      integrantes: grupo.map((e, i) => ({ empresaId: e.empresaId, nombre: e.nombre, porcentaje: Math.round(pcts[i]) })),
      experienciaResultanteSmmlv: experienciaPonderada(valoresPropios, pcts),
      financieroResultantePorAnio: [],
      factible: false,
      motivoNoFactible: `Ni concentrando la participación al máximo se alcanza el mínimo de ${umbral} SMMLV de experiencia con este grupo.`,
    };
  }

  // Si la asignación proporcional inicial ya no alcanza el umbral de experiencia, desplazar
  // participación hacia el integrante de mayor valor propio hasta lograrlo.
  function experienciaCumple(p: number[]): boolean {
    return experienciaPonderada(valoresPropios, p) >= umbral;
  }
  let paso = (100 - pisoTotal) / PASOS_AJUSTE;
  let iter = 0;
  while (!experienciaCumple(pcts) && iter < PASOS_AJUSTE * 2) {
    const donanteIdx = pcts.reduce(
      (peorIdx, v, i) => (i !== maxPosibleIdx && v > pcts[peorIdx] && peorIdx !== maxPosibleIdx ? i : peorIdx),
      pcts.findIndex((_, i) => i !== maxPosibleIdx),
    );
    if (donanteIdx === -1 || pcts[donanteIdx] - paso < PISO_PARTICIPACION_PCT) break;
    pcts[donanteIdx] -= paso;
    pcts[maxPosibleIdx] += paso;
    iter++;
  }

  // Ajuste del eje financiero: desplazar % desde el integrante que menos aporta financieramente
  // hacia el que más aporta, mientras la experiencia ponderada se mantenga sobre el umbral.
  function financieroCumple(p: number[]): { ok: boolean; resultado: ResultadoFinancieroAnio[] } {
    const resultado = evaluarFinancieroConPcts(grupo, p, requisitosFinancieros);
    return { ok: resultado.length > 0 && resultado.every((f) => f.cumple), resultado };
  }

  let evalFin = financieroCumple(pcts);
  if (!evalFin.ok && n > 1) {
    // Puntaje individual (100% solo) de cada integrante, como proxy de a quién conviene subirle %.
    const puntajeIndividual = grupo.map((e) => {
      const porAnio = new Map<string, { indicador: IndicadorFinancieroInput; pct: number }[]>();
      for (const [periodo, indicador] of e.indicadoresPorAnio) porAnio.set(periodo, [{ indicador, pct: 100 }]);
      const r = scoreRequisitosFinancierosPorAnio(porAnio, requisitosFinancieros);
      return r.length > 0 ? Math.min(...r.map((x) => x.puntajeTotal)) : -Infinity;
    });
    const mejorIdx = puntajeIndividual.indexOf(Math.max(...puntajeIndividual));

    paso = (100 - pisoTotal) / PASOS_AJUSTE;
    iter = 0;
    while (!evalFin.ok && iter < PASOS_AJUSTE) {
      const peorFinancieroIdx = puntajeIndividual.reduce(
        (peorIdx, v, i) => (i !== mejorIdx && (peorIdx === -1 || v < puntajeIndividual[peorIdx]) ? i : peorIdx),
        -1,
      );
      if (peorFinancieroIdx === -1 || pcts[peorFinancieroIdx] - paso < PISO_PARTICIPACION_PCT) break;
      const intento = [...pcts];
      intento[peorFinancieroIdx] -= paso;
      intento[mejorIdx] += paso;
      if (!experienciaCumple(intento)) break; // no sacrificar experiencia por financiero
      pcts = intento;
      evalFin = financieroCumple(pcts);
      iter++;
    }
  }

  pcts = pcts.map((p) => Math.round(p * 10) / 10);
  const sobra = 100 - pcts.reduce((a, b) => a + b, 0);
  pcts[maxPosibleIdx] = Math.round((pcts[maxPosibleIdx] + sobra) * 10) / 10;

  const experienciaFinal = experienciaPonderada(valoresPropios, pcts);
  const financieroFinal = evaluarFinancieroConPcts(grupo, pcts, requisitosFinancieros);
  const factible = experienciaFinal >= umbral && financieroFinal.length > 0 && financieroFinal.every((f) => f.cumple);

  return {
    integrantes: grupo.map((e, i) => ({ empresaId: e.empresaId, nombre: e.nombre, porcentaje: pcts[i] })),
    experienciaResultanteSmmlv: experienciaFinal,
    financieroResultantePorAnio: financieroFinal,
    factible,
    motivoNoFactible: factible
      ? undefined
      : experienciaFinal < umbral
        ? "No se encontró un reparto que alcance el mínimo de experiencia sin sacrificar el financiero."
        : "No se encontró un reparto que alcance el puntaje financiero mínimo en todos los años exigidos.",
  };
}

export function sugerirGruposConsorcio(
  empresas: EmpresaScoringInput[],
  requisitosFinancieros: RequisitosFinancierosEstructurado,
  requisitosTecnicos: RequisitosTecnicosEstructurado,
  hoy: Date = new Date(),
): GrupoConsorcioSugerido[] {
  const maxTamano = Math.min(
    requisitosTecnicos.max_integrantes_forma_asociativa ?? empresas.length,
    requisitosTecnicos.max_contratos ?? empresas.length,
    empresas.length,
  );
  if (maxTamano < 2) return [];

  const grupos = generarGrupos(empresas, 2, maxTamano);
  const sugerencias = grupos.map((g) => asignarParticipacionFactible(g, requisitosFinancieros, requisitosTecnicos, hoy));

  return sugerencias.sort((a, b) => {
    if (a.factible !== b.factible) return a.factible ? -1 : 1;
    return b.experienciaResultanteSmmlv - a.experienciaResultanteSmmlv === 0
      ? 0
      : a.experienciaResultanteSmmlv - b.experienciaResultanteSmmlv;
  });
}
