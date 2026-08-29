import Anthropic from "@anthropic-ai/sdk";
import type { VerificacionTitular } from "@/lib/types";

const TOOL_NAME = "registrar_verificacion_titular";
const MODEL = "claude-sonnet-5";

export interface VerificacionTitularResultado {
  rol: VerificacionTitular;
  nota: string;
}

export async function verificarTitularExperiencia(
  contexto: {
    empresaNombre: string;
    entidad_contratante: string;
    objeto: string;
    numero_contrato: string | null;
  },
  documentos: { nombre: string; base64: string }[],
): Promise<VerificacionTitularResultado> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const content: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: `Eres un abogado especializado en contratación estatal colombiana. Este contrato está registrado en el sistema como experiencia de la empresa "${contexto.empresaNombre}":

- Entidad contratante: ${contexto.entidad_contratante}
- Objeto: ${contexto.objeto}
- Número de contrato: ${contexto.numero_contrato ?? "no registrado"}

Lee el/los certificado(s) adjuntos y determina el ROL REAL que tuvo "${contexto.empresaNombre}" en ese contrato, leyendo con cuidado quién es nombrado explícitamente como contratista, y en qué calidad:

- "contratista_directo": el documento nombra a "${contexto.empresaNombre}" (o una razón social claramente equivalente, ej. con sigla distinta pero mismo NIT/nombre) como el contratista directo de la entidad contratante, actuando sola.
- "consorciado": el documento nombra a "${contexto.empresaNombre}" como integrante de un consorcio o unión temporal que fue el contratista directo (verás el nombre de la empresa junto a otras, bajo una figura de consorcio/UT).
- "subcontratista": el contratista directo nombrado en el documento es UNA EMPRESA DISTINTA, y "${contexto.empresaNombre}" aparece (si acaso) solo como ejecutor de una parte de la obra por encargo de ese contratista distinto, o no se explica su rol pero el contratante certificado es otro.
- "no_coincide": "${contexto.empresaNombre}" no aparece mencionada en el documento en ningún rol identificable — el documento certifica a un tercero completamente distinto sin relación evidente.

Sé muy literal: si el documento certifica que el contratista fue "Inversiones y Suministros JYP SAS" (o cualquier otra razón social distinta) y no menciona a "${contexto.empresaNombre}" en absoluto, el rol es "no_coincide", incluso si el contrato fue registrado en el sistema a nombre de "${contexto.empresaNombre}".

En "nota" explica brevemente qué nombre(s) de contratista/ejecutor aparecen realmente en el documento y por qué asignaste ese rol.

Usa la herramienta "${TOOL_NAME}" para registrar el resultado.`,
    },
    ...documentos.map((doc) => ({
      type: "document" as const,
      source: {
        type: "base64" as const,
        media_type: "application/pdf" as const,
        data: doc.base64,
      },
      title: doc.nombre.slice(0, 240),
    })),
  ];

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    tools: [
      {
        name: TOOL_NAME,
        description: "Registra el rol contractual real de una empresa en un contrato de experiencia, según el certificado adjunto.",
        input_schema: {
          type: "object",
          properties: {
            rol: {
              type: "string",
              enum: ["contratista_directo", "consorciado", "subcontratista", "no_coincide"],
            },
            nota: { type: "string" },
          },
          required: ["rol", "nota"],
        },
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content }],
  });

  const message = await stream.finalMessage();

  const toolUse = message.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolUse) {
    throw new Error("La IA no devolvió una verificación estructurada. Intenta de nuevo.");
  }

  if (message.stop_reason === "max_tokens") {
    throw new Error("El documento es demasiado extenso para procesarlo en una sola solicitud.");
  }

  return toolUse.input as VerificacionTitularResultado;
}
