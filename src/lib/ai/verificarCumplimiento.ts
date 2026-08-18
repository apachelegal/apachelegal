import Anthropic from "@anthropic-ai/sdk";
import type { RequisitoAnalisis, RequisitoVerificado } from "@/lib/types";

const TOOL_NAME = "registrar_verificacion";
const MODEL = "claude-sonnet-5";

export interface EmpresaContexto {
  nombre: string;
  participacionPct: number;
  indicadores: {
    periodo: string;
    patrimonio: number | null;
    capital_trabajo: number | null;
    indice_liquidez: number | null;
    indice_endeudamiento: number | null;
    rentabilidad_patrimonio: number | null;
    rentabilidad_activo: number | null;
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
        `- Rentabilidad del patrimonio: ${ind.rentabilidad_patrimonio != null ? ind.rentabilidad_patrimonio + "%" : "no especificado"}\n` +
        `- Rentabilidad del activo: ${ind.rentabilidad_activo != null ? ind.rentabilidad_activo + "%" : "no especificado"}`,
    );
  } else {
    partes.push("Indicadores financieros: no registrados en el sistema.");
  }

  if (e.experiencia.length > 0) {
    const lineas = e.experiencia.map(
      (x, i) =>
        `${i + 1}. ${x.entidad_contratante} — ${x.objeto} — Valor: ${formatoCOP(x.valor)}${x.sector ? ` — Sector: ${x.sector}` : ""} — ${x.fecha_inicio ?? "?"} a ${x.fecha_terminacion ?? "en ejecución"}${x.participacion_pct != null && x.participacion_pct !== 100 ? ` — Participación: ${x.participacion_pct}%` : ""}`,
    );
    partes.push(`Experiencia (${e.experiencia.length} contratos):\n${lineas.join("\n")}`);
  } else {
    partes.push("Experiencia: no hay contratos registrados en el sistema.");
  }

  return partes.join("\n\n");
}

export async function verificarCumplimiento(
  requisitosJuridicos: RequisitoAnalisis[],
  requisitosFinancieros: RequisitoAnalisis[],
  requisitosTecnicos: RequisitoAnalisis[],
  empresas: EmpresaContexto[],
): Promise<{ resumen: string; resultados: RequisitoVerificado[] }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const esEstructuraPlural = empresas.length > 1;

  const text = `Eres un abogado especializado en contratación estatal colombiana. Debes evaluar si él o los proponentes descritos abajo cumplen los requisitos habilitantes de una licitación pública, comparando cada requisito contra los datos reales de la(s) empresa(s).

${formatearRequisitos("REQUISITOS JURÍDICOS", requisitosJuridicos)}

${formatearRequisitos("REQUISITOS FINANCIEROS", requisitosFinancieros)}

${formatearRequisitos("REQUISITOS TÉCNICOS", requisitosTecnicos)}

DATOS DE ${esEstructuraPlural ? "LOS PROPONENTES (estructura plural / consorcio o unión temporal)" : "EL PROPONENTE"}:

${empresas.map(formatearEmpresa).join("\n\n---\n\n")}

INSTRUCCIONES:
${esEstructuraPlural ? "- Como participan varias empresas, combina su capacidad según las reglas de acreditación para estructuras plurales que aparezcan explícitamente en los requisitos jurídicos anteriores. Si el pliego no especifica una regla clara, usa el criterio estándar colombiano: patrimonio y capital de trabajo se suman proporcionalmente a la participación; los índices de liquidez y endeudamiento se ponderan por participación; la experiencia de cualquiera de los integrantes es acreditable por el conjunto salvo que el pliego diga lo contrario. Explica en la justificación cómo combinaste los datos." : ""}
- Para cada requisito, evalúa usando la herramienta "${TOOL_NAME}" con un veredicto: "si" (cumple claramente), "no" (claramente no cumple), "parcial" (cumple algunas condiciones del requisito pero no todas), o "no_determinable" (no hay suficiente información registrada en el sistema para evaluarlo, por ejemplo documentos jurídicos que no están digitalizados aquí).
- Sé honesto cuando falte información: no asumas que algo se cumple si no tienes el dato. Es preferible marcar "no_determinable" que adivinar.
- En "que_falta", indica específicamente qué información o condición falta para poder acreditar el requisito (solo cuando el veredicto no sea "si").
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

  return toolUse.input as { resumen: string; resultados: RequisitoVerificado[] };
}
