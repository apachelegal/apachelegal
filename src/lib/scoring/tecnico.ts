import type { Experiencia, RequisitosTecnicosEstructurado } from "@/lib/types";
import type { ResultadoTecnico } from "./tipos";
import { valorASmmlv } from "./smmlv";

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "y", "en", "a", "para", "con", "al", "un", "una",
  "por", "su", "sus", "que", "o", "u", "e", "sistemas", "infraestructura", "tipo", "tipos",
]);

/** Palabras significativas de 4+ letras, ignorando conectores y términos genéricos sin valor discriminante. */
function palabrasClave(texto: string): string[] {
  return normalizar(texto)
    .replace(/[().,;:]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 4 && !STOPWORDS.has(p));
}

/**
 * Compara por superposición de palabras clave, no por frase completa: las categorías elegibles
 * que extrae la IA suelen ser descripciones largas y compuestas (ej. "Infraestructura de
 * sistemas primarios de acueducto (tanques, redes, aducciones...)"), que casi nunca aparecen
 * como subcadena literal en el objeto corto de un contrato. Basta con que el objeto/sector
 * comparta al menos una palabra técnica significativa con alguna categoría.
 */
function coincideCategoria(exp: Experiencia, categorias: string[]): boolean {
  if (categorias.length === 0) return true;
  const palabrasObjeto = new Set(palabrasClave(`${exp.objeto} ${exp.sector ?? ""}`));
  if (palabrasObjeto.size === 0) return false;
  return categorias.some((categoria) => palabrasClave(categoria).some((p) => palabrasObjeto.has(p)));
}

/**
 * La redacción más común en pliegos colombianos (EAAB, INVIAS) solo exige que el contrato haya
 * TERMINADO dentro de la ventana ("...que se hayan terminado y recibido a satisfacción en los
 * últimos N años"). Algunos pliegos (EPM) exigen además que también haya sido EJECUTADO dentro de
 * la ventana ("ejecutados e terminados"), lo cual requiere fecha_inicio; ese caso se activa con
 * `requiereFechaInicio`.
 */
function dentroDeVentana(
  exp: Experiencia,
  ventanaAnios: number | null,
  hoy: Date,
  requiereFechaInicio: boolean,
): boolean {
  if (ventanaAnios == null) return true;
  const limite = new Date(hoy);
  limite.setFullYear(limite.getFullYear() - ventanaAnios);
  const fin = exp.fecha_terminacion ? new Date(exp.fecha_terminacion) : null;
  if (!fin) return false;
  if (!requiereFechaInicio) return fin >= limite;
  const inicio = exp.fecha_inicio ? new Date(exp.fecha_inicio) : null;
  if (!inicio) return false;
  return inicio >= limite && fin >= limite;
}

/**
 * Determina si un contrato de experiencia es elegible para acreditar un requisito técnico.
 * Un titular "no_coincide" siempre se excluye (es un error de datos, no una decisión de
 * política del pliego) — así se detecta a futuro el mismo error que se cometió con el
 * contrato de Quantum atribuido en realidad a "Inversiones y Suministros JYP SAS".
 * El tratamiento de "subcontratista" sí depende de las reglas del pliego: puede excluirse,
 * permitirse libremente, o permitirse con condiciones que requieren revisión manual (el motor
 * determinístico no puede validar condiciones en texto libre, así que las marca en vez de
 * asumir que se cumplen).
 */
export function esExperienciaElegible(
  exp: Experiencia,
  requisitos: RequisitosTecnicosEstructurado,
  hoy: Date = new Date(),
): { elegible: boolean; motivo?: string; requiereRevision?: boolean } {
  if (exp.estado === "en_ejecucion") {
    return { elegible: false, motivo: "Contrato en ejecución, no cuenta como experiencia habilitante." };
  }
  if (exp.verificacion_titular === "no_coincide") {
    return {
      elegible: false,
      motivo: "El certificado adjunto no nombra a esta empresa como parte del contrato (verificado).",
    };
  }
  if (exp.verificacion_titular === "subcontratista") {
    if (requisitos.tratamiento_subcontratista === "excluye") {
      return { elegible: false, motivo: "Experiencia como subcontratista, excluida por este pliego." };
    }
    if (requisitos.tratamiento_subcontratista === "permite_con_reglas") {
      return {
        elegible: true,
        requiereRevision: true,
        motivo: `Experiencia como subcontratista permitida solo bajo condiciones: ${requisitos.reglas_subcontratista ?? "revisar el pliego"}.`,
      };
    }
    // "permite" sin condiciones especiales
  }
  if (!dentroDeVentana(exp, requisitos.ventana_recencia_anios, hoy, requisitos.ventana_requiere_fecha_inicio ?? false)) {
    return { elegible: false, motivo: "Fuera de la ventana de recencia exigida." };
  }
  if (!coincideCategoria(exp, requisitos.categorias_elegibles)) {
    return { elegible: false, motivo: "El objeto/sector no coincide con las categorías elegibles del pliego." };
  }
  return { elegible: true };
}

interface ContratoValorado {
  exp: Experiencia;
  valor: number;
  empresaIndex: number;
}

function contratosElegiblesOrdenados(
  experiencia: Experiencia[],
  requisitos: RequisitosTecnicosEstructurado,
  hoy: Date,
  empresaIndex: number,
): { elegibles: ContratoValorado[]; excluidos: { experiencia: Experiencia; motivo: string }[] } {
  const excluidos: { experiencia: Experiencia; motivo: string }[] = [];
  const elegibles: ContratoValorado[] = [];

  for (const exp of experiencia) {
    const evalItem = esExperienciaElegible(exp, requisitos, hoy);
    if (!evalItem.elegible) {
      excluidos.push({ experiencia: exp, motivo: evalItem.motivo ?? "No elegible." });
      continue;
    }
    const smmlv = exp.valor_smmlv ?? valorASmmlv(exp.valor, exp.fecha_terminacion) ?? 0;
    const valorPropio = smmlv * ((exp.participacion_pct ?? 100) / 100);
    elegibles.push({ exp, valor: valorPropio, empresaIndex });
    if (evalItem.requiereRevision) {
      excluidos.push({ experiencia: exp, motivo: `Incluido en el total, pero ${evalItem.motivo}` });
    }
  }
  elegibles.sort((a, b) => b.valor - a.valor);
  return { elegibles, excluidos };
}

function armarResultado(
  seleccionados: ContratoValorado[],
  excluidos: { experiencia: Experiencia; motivo: string }[],
  requisitos: RequisitosTecnicosEstructurado,
): ResultadoTecnico {
  const valorSmmlvElegible = seleccionados.reduce((sum, c) => sum + c.valor, 0);
  const cumpleMinimo =
    requisitos.valor_minimo_acumulado_smmlv == null ||
    valorSmmlvElegible >= requisitos.valor_minimo_acumulado_smmlv;
  return {
    valorSmmlvElegible,
    contratosElegibles: seleccionados.map((c) => c.exp),
    contratosExcluidos: excluidos,
    cumpleMinimo,
  };
}

/** Evaluación individual: la empresa ES el oferente completo, así que `max_contratos` aplica directo a ella. */
export function evaluarExperienciaEmpresa(
  experiencia: Experiencia[],
  requisitos: RequisitosTecnicosEstructurado,
  hoy: Date = new Date(),
): ResultadoTecnico {
  const { elegibles, excluidos } = contratosElegiblesOrdenados(experiencia, requisitos, hoy, 0);
  const seleccionados =
    requisitos.max_contratos != null ? elegibles.slice(0, requisitos.max_contratos) : elegibles;
  return armarResultado(seleccionados, excluidos, requisitos);
}

/**
 * Evaluación en forma asociativa: `max_contratos` es un tope del CONJUNTO del oferente, no de
 * cada integrante por separado (si no, un consorcio de 2 empresas con tope de 2 contratos podría
 * terminar presentando 4). Cada integrante recibe primero su mínimo obligatorio
 * (`min_contratos_por_integrante`, o 1 si el pliego no lo especifica); los cupos que sobren del
 * tope total se reparten por valor, sin importar de qué integrante vengan.
 */
export function evaluarExperienciaGrupo(
  experienciaPorEmpresa: Experiencia[][],
  requisitos: RequisitosTecnicosEstructurado,
  hoy: Date = new Date(),
): ResultadoTecnico[] {
  const n = experienciaPorEmpresa.length;
  const porEmpresa = experienciaPorEmpresa.map((exp, i) => contratosElegiblesOrdenados(exp, requisitos, hoy, i));

  const minPorIntegrante = requisitos.min_contratos_por_integrante ?? 1;
  const seleccionPorEmpresa: ContratoValorado[][] = porEmpresa.map(({ elegibles }) =>
    elegibles.slice(0, minPorIntegrante),
  );

  const totalObligatorio = seleccionPorEmpresa.reduce((sum, s) => sum + s.length, 0);
  const cupoRestante = requisitos.max_contratos != null ? requisitos.max_contratos - totalObligatorio : Infinity;

  if (cupoRestante > 0 && cupoRestante !== Infinity) {
    const restantes = porEmpresa
      .flatMap(({ elegibles }, i) => elegibles.slice(minPorIntegrante).map((c) => ({ ...c, empresaIndex: i })))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, cupoRestante);
    for (const c of restantes) seleccionPorEmpresa[c.empresaIndex].push(c);
  } else if (cupoRestante === Infinity) {
    porEmpresa.forEach(({ elegibles }, i) => {
      seleccionPorEmpresa[i] = elegibles;
    });
  }

  return porEmpresa.map(({ excluidos }, i) => armarResultado(seleccionPorEmpresa[i], excluidos, requisitos));
}
