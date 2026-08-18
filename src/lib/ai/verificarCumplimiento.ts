import Anthropic from "@anthropic-ai/sdk";
import type { RequisitoAnalisis, RequisitoVerificado } from "@/lib/types";

const TOOL_NAME = "registrar_verificacion";
const MODEL = "claude-sonnet-5";

export interface EmpresaContexto {
  nombre: string;
  participacionPct: number;
  experienciaExcluidaEnEjecucion?: number;
  registraObrasInconclusas: boolean | null;
  esEmpresaMujeres: boolean | null;
  indicadores: {
    periodo: string;
    patrimonio: number | null;
    capital_trabajo: number | null;
    indice_liquidez: number | null;
    indice_endeudamiento: number | null;
    razon_cobertura_intereses: number | null;
    rentabilidad_patrimonio: number | null;
    rentabilidad_activo: number | null;
    activo_corriente: number | null;
    pasivo_corriente: number | null;
    activo_total: number | null;
    pasivo_total: number | null;
    utilidad_operacional: number | null;
    gastos_financieros: number | null;
  } | null;
  experiencia: {
    entidad_contratante: string;
    objeto: string;
    valor: number | null;
    sector: string | null;
    fecha_inicio: string | null;
    fecha_terminacion: string | null;
    participacion_pct: number | null;
  }[];
}

function formatoCOP(v: number | null): string {
  if (v == null) return "no especificado";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
}

function formatearRequisitos(titulo: string, items: RequisitoAnalisis[]): string {
  if (items.length === 0) return `${titulo}: ninguno detectado.`;
  const lineas = items.map(
    (r, i) => `${i + 1}. ${r.requisito}${r.detalle ? ` — ${r.detalle}` : ""}${r.fuente ? ` (Fuente: ${r.fuente})` : ""}`,
  );
  return `${titulo}:\n${lineas.join("\n")}`;
}

function formatearEmpresa(e: EmpresaContexto): string {
  const partes: string[] = [`EMPRESA: ${e.nombre} (participación en esta oferta: ${e.participacionPct}%)`];

  if (e.indicadores) {
    const ind = e.indicadores;
    partes.push(
      `Indicadores financieros (período ${ind.periodo}):\n` +
        `- Patrimonio: ${formatoCOP(ind.patrimonio)}\n` +
        `- Capital de trabajo: ${formatoCOP(ind.capital_trabajo)}\n` +
        `- Índice de liquidez: ${ind.indice_liquidez ?? "no especificado"}\n` +
        `- Índice de endeudamiento: ${ind.indice_endeudamiento != null ? ind.indice_endeudamiento + "%" : "no especificado"}\n` +
        `- Razón de cobertura de intereses: ${ind.razon_cobertura_intereses ?? "no especificado"}\n` +
        `- Rentabilidad del patrimonio: ${ind.rentabilidad_patrimonio != null ? ind.rentabilidad_patrimonio + "%" : "no especificado"}\n` +
        `- Rentabilidad del activo: ${ind.rentabilidad_activo != null ? ind.rentabilidad_activo + "%" : "no especificado"}\n` +
        `- Valores contables base — Activo corriente: ${formatoCOP(ind.activo_corriente)}, Pasivo corriente: ${formatoCOP(ind.pasivo_corriente)}, Activo total: ${formatoCOP(ind.activo_total)}, Pasivo total: ${formatoCOP(ind.pasivo_total)}, Utilidad operacional: ${formatoCOP(ind.utilidad_operacional)}, Gastos financieros: ${formatoCOP(ind.gastos_financieros)}`,
    );
  } else {
    partes.push("Indicadores financieros: no registrados en el sistema.");
  }

  partes.push(
    `Criterios de puntaje adicional — Registra obras inconclusas: ${e.registraObrasInconclusas == null ? "sin verificar" : e.registraObrasInconclusas ? "SÍ (afecta puntaje negativamente en la mayoría de entidades)" : "no"}; Empresa/emprendimiento de mujeres acreditado: ${e.esEmpresaMujeres == null ? "sin verificar" : e.esEmpresaMujeres ? "sí" : "no"}.`,
  );

  if (e.experiencia.length > 0) {
    const lineas = e.experiencia.map(
      (x, i) =>
        `${i + 1}. ${x.entidad_contratante} — ${x.objeto} — Valor: ${formatoCOP(x.valor)}${x.sector ? ` — Sector: ${x.sector}` : ""} — ${x.fecha_inicio ?? "?"} a ${x.fecha_terminacion ?? "en ejecución"}${x.participacion_pct != null && x.participacion_pct !== 100 ? ` — Participación: ${x.participacion_pct}%` : ""}`,
    );
    partes.push(`Experiencia habilitante (${e.experiencia.length} contratos terminados/liquidados):\n${lineas.join("\n")}`);
  } else {
    partes.push(
      "Experiencia habilitante: NINGUNA. Esta empresa no tiene contratos terminados o liquidados registrados que puedan acreditar experiencia (los contratos en ejecución no cuentan como experiencia habilitante y ya fueron excluidos).",
    );
  }
  if (e.experienciaExcluidaEnEjecucion) {
    partes.push(
      `Nota: se excluyeron ${e.experienciaExcluidaEnEjecucion} contrato(s) en ejecución de esta lista porque no cuentan como experiencia habilitante para procesos futuros.`,
    );
  }

  return partes.join("\n\n");
}

export async function verificarCumplimiento(
  requisitosJuridicos: RequisitoAnalisis[],
  requisitosFinancieros: RequisitoAnalisis[],
  requisitosTecnicos: RequisitoAnalisis[],
  empresas: EmpresaContexto[],
  presupuestoOficial: number | null,
): Promise<{ resumen: string; resultados: RequisitoVerificado[] }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const esEstructuraPlural = empresas.length > 1;

  const text = `Eres un abogado especializado en contratación estatal colombiana. Debes evaluar si él o los proponentes descritos abajo cumplen los requisitos habilitantes de una licitación pública, comparando cada requisito contra los datos reales de la(s) empresa(s).

Presupuesto Oficial (PO) de esta invitación: ${presupuestoOficial != null ? formatoCOP(presupuestoOficial) : "no registrado en el sistema — cualquier requisito expresado como porcentaje del Presupuesto Oficial (capital de trabajo, patrimonio, experiencia en SMMLV, etc.) debe marcarse como no_determinable indicando que falta este dato"}. Usa este valor para calcular cualquier umbral financiero o de experiencia que el pliego exprese como porcentaje del Presupuesto Oficial (ej. "Capital de trabajo ≥ 30% del PO" significa Capital de trabajo ≥ ${presupuestoOficial != null ? formatoCOP(presupuestoOficial * 0.3) : "30% del PO"} cuando el porcentaje exigido sea 30%; ajusta el porcentaje al que realmente indique cada requisito).

${formatearRequisitos("REQUISITOS JURÍDICOS", requisitosJuridicos)}

${formatearRequisitos("REQUISITOS FINANCIEROS", requisitosFinancieros)}

${formatearRequisitos("REQUISITOS TÉCNICOS", requisitosTecnicos)}

DATOS DE ${esEstructuraPlural ? "LOS PROPONENTES (estructura plural / consorcio o unión temporal)" : "EL PROPONENTE"}:

${empresas.map(formatearEmpresa).join("\n\n---\n\n")}

INSTRUCCIONES:
${
  esEstructuraPlural
    ? `- Como participan varias empresas (estructura plural), combina su capacidad según las reglas de acreditación que aparezcan explícitamente en los requisitos anteriores. Si el pliego no especifica una regla propia, usa el criterio estándar colombiano (metodología de indicadores de Colombia Compra Eficiente / RUP), aplicando SIEMPRE estas fórmulas:
  - Patrimonio y capital de trabajo son montos absolutos: se suman ponderando por participación → Patrimonio_plural = Σ(patrimonio_i × %i); Capital_trabajo_plural = Σ(capital_trabajo_i × %i).
  - Además de la suma ponderada, el PATRIMONIO exige una condición individual adicional: cada integrante, por separado, debe cumplir Patrimonio_i ≥ (umbral exigido × %i de ese integrante). Verifica esta condición individual para cada empresa, no solo el agregado.
  - Índice de liquidez, nivel de endeudamiento, razón de cobertura de intereses, rentabilidad del patrimonio y rentabilidad del activo son RAZONES (ratios), no montos. La forma correcta de combinarlas para un oferente plural NUNCA es promediar ni ponderar los ratios de cada integrante directamente — siempre se deben ponderar/sumar primero los componentes contables base (activo corriente, pasivo corriente, activo total, pasivo total, utilidad operacional, gastos financieros) por % de participación, y sobre esos totales combinados calcular el ratio final:
    - Liquidez_plural = Σ(activo_corriente_i × %i) / Σ(pasivo_corriente_i × %i)
    - Endeudamiento_plural = Σ(pasivo_total_i × %i) / Σ(activo_total_i × %i)
    - RCI_plural = Σ(utilidad_operacional_i × %i) / Σ(gastos_financieros_i × %i)
    - Rentabilidad_patrimonio_plural = Σ(utilidad_operacional_i × %i) / Σ(patrimonio_i × %i)
    - Rentabilidad_activo_plural = Σ(utilidad_operacional_i × %i) / Σ(activo_total_i × %i)
    Usa estas fórmulas SIEMPRE que todas las empresas del grupo tengan los valores contables base necesarios registrados. Si a alguna empresa le falta alguno de esos valores base, NO calcules un promedio ponderado de los ratios individuales como sustituto (es matemáticamente incorrecto) — marca ese indicador puntual como "no_determinable", indicando en "que_falta" exactamente qué valor contable base falta y de qué empresa.
  - REGLA DE EXPERIENCIA EN ESTRUCTURAS PLURALES: salvo que el pliego indique expresamente lo contrario, la práctica y normativa estándar en contratación estatal colombiana exige que TODOS los integrantes de un oferente plural aporten experiencia propia — no basta con que uno solo aporte toda la experiencia del grupo. Revisa la lista de "Experiencia habilitante" de cada empresa: si alguna empresa participante tiene 0 contratos de experiencia habilitante (después de excluir los en ejecución), márcalo como un riesgo grave en el requisito de experiencia general: usa veredicto "no" o "parcial" según el peso de esa empresa en la participación, e indica expresamente en la justificación cuál empresa no aporta experiencia propia y que esto puede causar el rechazo de toda la oferta plural por ese solo motivo, independientemente de que el resto del grupo sí acredite la experiencia requerida.
  Explica siempre en la justificación cómo combinaste los datos.`
    : ""
}
- Para cada requisito, evalúa usando la herramienta "${TOOL_NAME}" con un veredicto: "si" (cumple claramente), "no" (claramente no cumple), "parcial" (cumple algunas condiciones del requisito pero no todas), o "no_determinable" (no hay suficiente información registrada en el sistema para evaluarlo, por ejemplo documentos jurídicos que no están digitalizados aquí).
- Sé honesto cuando falte información: no asumas que algo se cumple si no tienes el dato. Es preferible marcar "no_determinable" que adivinar.
- En "que_falta", indica específicamente qué información o condición falta para poder acreditar el requisito (solo cuando el veredicto no sea "si").
- Los "Criterios de puntaje adicional" (obras inconclusas, empresa de mujeres) de cada empresa NO son requisitos habilitantes — no generes un ítem de verificación por ellos. Menciónalos brevemente en el "resumen" solo como información de contexto sobre el puntaje final esperado (por ejemplo, si alguna empresa registra obras inconclusas, adviértelo porque suele penalizar fuertemente el puntaje aunque no impida participar).
- Al final, en el campo "resumen", da una evaluación general de 3 a 5 líneas: qué tan preparado está el proponente para presentarse a este proceso y cuáles son los puntos críticos a resolver antes del cierre.`;

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    tools: [
      {
        name: TOOL_NAME,
        description: "Registra la verificación de cumplimiento de requisitos de una licitación.",
        input_schema: {
          type: "object",
          properties: {
            resumen: { type: "string", description: "Evaluación general de 3 a 5 líneas" },
            resultados: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  categoria: { type: "string", enum: ["juridico", "financiero", "tecnico"] },
                  requisito: { type: "string" },
                  cumple: { type: "string", enum: ["si", "no", "parcial", "no_determinable"] },
                  justificacion: { type: "string" },
                  que_falta: { type: "string" },
                },
                required: ["categoria", "requisito", "cumple", "justificacion"],
              },
            },
          },
          required: ["resumen", "resultados"],
        },
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: text }],
  });

  const message = await stream.finalMessage();

  const toolUse = message.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolUse) {
    throw new Error("La IA no devolvió una verificación estructurada. Intenta de nuevo.");
  }

  if (message.stop_reason === "max_tokens") {
    throw new Error(
      "Hay demasiada información para procesar en una sola verificación (muchos requisitos o mucha experiencia). Intenta reducir el número de empresas participantes.",
    );
  }

  const raw = toolUse.input as { resumen: string; resultados: RequisitoVerificado[] | string };

  // La IA a veces devuelve "resultados" como un string JSON en vez de un array nativo
  // pese al schema forzado; se normaliza aquí para no romper el resto del flujo.
  const resultados = typeof raw.resultados === "string" ? JSON.parse(raw.resultados) : raw.resultados;

  if (!Array.isArray(resultados)) {
    throw new Error("La IA no devolvió los resultados de verificación en el formato esperado. Intenta de nuevo.");
  }

  return { resumen: raw.resumen, resultados };
}
