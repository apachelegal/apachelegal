import Anthropic from "@anthropic-ai/sdk";

const TOOL_NAME = "registrar_indicadores";
const MODEL = "claude-sonnet-5";

export interface IndicadoresExtraidos {
  periodo: string;
  patrimonio: number | null;
  capital_trabajo: number | null;
  indice_liquidez: number | null;
  indice_endeudamiento: number | null;
  rentabilidad_patrimonio: number | null;
  rentabilidad_activo: number | null;
  notas: string | null;
}

export async function extraerIndicadores(
  documentos: { nombre: string; base64: string }[],
): Promise<IndicadoresExtraidos> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const content: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: `Eres un contador especializado en contratación estatal colombiana. A continuación se adjunta el RUP (Registro Único de Proponentes) y/o los estados financieros de una empresa.

Extrae los indicadores financieros del período más reciente disponible y regístralos con la herramienta "${TOOL_NAME}":
- Período (año del corte, ej. "2025")
- Patrimonio
- Capital de trabajo (activo corriente menos pasivo corriente)
- Índice de liquidez (activo corriente / pasivo corriente)
- Índice de endeudamiento, como porcentaje (pasivo total / activo total × 100)
- Rentabilidad del patrimonio, como porcentaje (utilidad operacional / patrimonio × 100)
- Rentabilidad del activo, como porcentaje (utilidad operacional / activo total × 100)

Si el documento ya trae estos indicadores calculados (como suele pasar en el RUP), úsalos directamente en vez de recalcularlos. Si algún valor no aparece o no se puede determinar con certeza, déjalo sin diligenciar — no inventes cifras. En "notas" indica el período exacto de corte de los datos y cualquier advertencia relevante (por ejemplo si los datos parecen desactualizados).`,
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
    max_tokens: 4096,
    tools: [
      {
        name: TOOL_NAME,
        description: "Registra los indicadores financieros extraídos del RUP o estados financieros.",
        input_schema: {
          type: "object",
          properties: {
            periodo: { type: "string", description: "Año del corte, ej. 2025" },
            patrimonio: { type: "number" },
            capital_trabajo: { type: "number" },
            indice_liquidez: { type: "number" },
            indice_endeudamiento: { type: "number", description: "Como porcentaje, ej. 42 para 42%" },
            rentabilidad_patrimonio: { type: "number", description: "Como porcentaje" },
            rentabilidad_activo: { type: "number", description: "Como porcentaje" },
            notas: { type: "string" },
          },
          required: ["periodo"],
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
    throw new Error("La IA no devolvió indicadores estructurados. Intenta de nuevo.");
  }

  if (message.stop_reason === "max_tokens") {
    throw new Error("El documento es demasiado extenso para procesarlo en una sola solicitud.");
  }

  return toolUse.input as IndicadoresExtraidos;
}
