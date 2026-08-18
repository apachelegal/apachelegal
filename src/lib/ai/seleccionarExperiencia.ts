import Anthropic from "@anthropic-ai/sdk";
import type { RequisitoAnalisis } from "@/lib/types";

const TOOL_NAME = "registrar_seleccion";
const MODEL = "claude-sonnet-5";

export interface ExperienciaCandidata {
  id: string;
  empresaNombre: string;
  entidad_contratante: string;
  objeto: string;
  valor: number | null;
  valor_smmlv: number | null;
  codigo_unspsc: string | null;
  consecutivo_rup: string | null;
  fecha_inicio: string | null;
  fecha_terminacion: string | null;
  detalles: Record<string, unknown> | null;
}

export interface SeleccionResultado {
  resumen: string;
  seleccionados: {
    experiencia_id: string;
    justificacion: string;
    actividad_acreditada: string | null;
  }[];
}

function formatearCandidata(c: ExperienciaCandidata): string {
  const partes = [
    `id=${c.id}`,
    `empresa="${c.empresaNombre}"`,
    `entidad="${c.entidad_contratante}"`,
    `objeto="${c.objeto}"`,
    c.valor != null ? `valor=$${c.valor.toLocaleString("es-CO")}` : "valor=no especificado",
    c.valor_smmlv != null ? `SMMLV=${c.valor_smmlv}` : "SMMLV=no especificado",
    c.codigo_unspsc ? `UNSPSC=${c.codigo_unspsc}` : "UNSPSC=no especificado",
    c.consecutivo_rup ? `consecutivoRUP=${c.consecutivo_rup}` : "consecutivoRUP=no especificado",
    `periodo=${c.fecha_inicio ?? "?"}..${c.fecha_terminacion ?? "?"}`,
    c.detalles && Object.keys(c.detalles).length > 0 ? `detalles=${JSON.stringify(c.detalles)}` : "",
  ].filter(Boolean);
  return partes.join(" | ");
}

export async function seleccionarExperiencia(
  requisitosTecnicos: RequisitoAnalisis[],
  candidatas: ExperienciaCandidata[],
): Promise<SeleccionResultado> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const requisitosTexto = requisitosTecnicos
    .map((r, i) => `${i + 1}. ${r.requisito}${r.detalle ? ` — ${r.detalle}` : ""}${r.fuente ? ` (Fuente: ${r.fuente})` : ""}`)
    .join("\n");

  const candidatasTexto = candidatas.map((c) => `- ${formatearCandidata(c)}`).join("\n");

  const text = `Eres un abogado especializado en contratación estatal colombiana. Tu tarea es elegir, de la lista de contratos de experiencia disponibles de el/los proponente(s), cuáles se deben citar formalmente para acreditar la experiencia técnica exigida en esta licitación.

REQUISITOS TÉCNICOS DEL PLIEGO (incluye la regla de cuántos contratos se pueden citar como máximo, y si exige algún código UNSPSC obligatorio):
${requisitosTexto || "No se detectaron requisitos técnicos específicos."}

CONTRATOS DISPONIBLES (ya excluye los que están en ejecución, que no cuentan como experiencia habilitante):
${candidatasTexto || "Ninguno."}

INSTRUCCIONES:
- Busca en los requisitos técnicos anteriores la regla que limita el número máximo de contratos que se pueden citar (por ejemplo "máximo 4 contratos"). Determina, según cómo esté redactada esa regla en ESTE pliego específico, si el límite aplica por cada empresa/integrante por separado o es un tope compartido para toda la oferta plural en conjunto, y aplícalo así. Explica en el resumen cuál interpretación usaste y por qué.
- Si el pliego exige que al menos uno de los contratos tenga un código UNSPSC específico, prioriza incluir un contrato que lo tenga. Si ningún contrato disponible tiene ese código, dilo explícitamente en el resumen como un riesgo — no fuerces una selección incorrecta.
- Entre los contratos que califican, prioriza los que mejor acrediten las actividades técnicas específicas exigidas (usa el campo "detalles" si trae cantidades como l/s, m3, metros de tubería, etc.) y los de mayor valor en SMMLV, ya que suele ayudar a superar también el umbral de experiencia en facturación.
- Para cada contrato que selecciones, usa el "id" EXACTO que aparece en la lista de arriba (no inventes ids) y explica en "justificacion" por qué lo elegiste y qué requisito o actividad acredita. Si acredita una actividad técnica específica numerada en el pliego (ej. "Actividad No. 1"), indícalo en "actividad_acreditada"; si no aplica, omite ese campo.
- En el campo "resumen", explica brevemente el criterio de selección usado y cualquier requisito que no se pueda acreditar con los contratos disponibles.
- Usa la herramienta "${TOOL_NAME}" para registrar el resultado.`;

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    tools: [
      {
        name: TOOL_NAME,
        description: "Registra la selección de contratos de experiencia para citar en la oferta.",
        input_schema: {
          type: "object",
          properties: {
            resumen: { type: "string", description: "Criterio de selección usado y riesgos detectados" },
            seleccionados: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  experiencia_id: { type: "string", description: "id exacto del contrato, tomado de la lista dada" },
                  justificacion: { type: "string" },
                  actividad_acreditada: { type: "string" },
                },
                required: ["experiencia_id", "justificacion"],
              },
            },
          },
          required: ["resumen", "seleccionados"],
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
    throw new Error("La IA no devolvió una selección estructurada. Intenta de nuevo.");
  }

  if (message.stop_reason === "max_tokens") {
    throw new Error("Hay demasiados contratos para procesar en una sola solicitud. Reduce el número de empresas participantes.");
  }

  const raw = toolUse.input as { resumen: string; seleccionados: SeleccionResultado["seleccionados"] | string };
  const seleccionados = typeof raw.seleccionados === "string" ? JSON.parse(raw.seleccionados) : raw.seleccionados;

  if (!Array.isArray(seleccionados)) {
    throw new Error("La IA no devolvió la selección en el formato esperado. Intenta de nuevo.");
  }

  const idsValidos = new Set(candidatas.map((c) => c.id));
  const seleccionadosFiltrados = seleccionados.filter((s) => idsValidos.has(s.experiencia_id));

  return { resumen: raw.resumen, seleccionados: seleccionadosFiltrados };
}
