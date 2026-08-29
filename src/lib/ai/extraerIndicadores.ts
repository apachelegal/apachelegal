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
  activo_corriente: number | null;
  pasivo_corriente: number | null;
  activo_total: number | null;
  pasivo_total: number | null;
  utilidad_operacional: number | null;
  gastos_financieros: number | null;
  razon_cobertura_intereses: number | null;
  efectivo_generado_operacion: number | null;
  efectivo_y_equivalentes: number | null;
  deuda_financiera: number | null;
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
- Razón de cobertura de intereses (utilidad operacional / gastos financieros o de intereses)
- Rentabilidad del patrimonio, como porcentaje (utilidad operacional / patrimonio × 100)
- Rentabilidad del activo, como porcentaje (utilidad operacional / activo total × 100)

Además, extrae también los VALORES CONTABLES BASE de donde salen esos indicadores, si el documento los trae por separado (el RUP normalmente los incluye en la sección de información financiera):
- Activo corriente
- Pasivo corriente
- Activo total
- Pasivo total
- Utilidad operacional
- Gastos financieros (gastos de intereses)

Estos valores contables base son importantes cuando esta empresa participe en un consorcio o unión temporal, porque para combinar correctamente los indicadores de varias empresas se deben sumar los valores base (no promediar los ratios ya calculados).

Si el documento adjunto incluye un ESTADO DE FLUJOS DE EFECTIVO (no solo el RUP), extrae también estos tres valores, que sirven para calcular indicadores reales de Cobertura de Intereses y Múltiplo de Deuda Neta:
- Efectivo Generado por Actividades de Operación (EAO / flujo de caja operacional)
- Efectivo y equivalentes de efectivo (saldo de caja/bancos e inversiones temporales al corte)
- Deuda financiera (obligaciones financieras con bancos/leasing, distinta del pasivo total)

Estos tres valores casi nunca aparecen en un RUP. Si el documento adjunto es solo un RUP o un resumen sin estado de flujos de efectivo, déjalos sin diligenciar — NO los aproximes con la utilidad operacional ni con el pasivo total, es matemáticamente incorrecto y puede llevar a una decisión equivocada sobre si la empresa cumple o no un requisito financiero.

Si el documento ya trae los indicadores calculados (como suele pasar en el RUP), úsalos directamente en vez de recalcularlos. Si algún valor no aparece o no se puede determinar con certeza, déjalo sin diligenciar — no inventes cifras. En "notas" indica el período exacto de corte de los datos y cualquier advertencia relevante (por ejemplo si los datos parecen desactualizados).`,
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
            razon_cobertura_intereses: { type: "number" },
            rentabilidad_patrimonio: { type: "number", description: "Como porcentaje" },
            rentabilidad_activo: { type: "number", description: "Como porcentaje" },
            activo_corriente: { type: "number" },
            pasivo_corriente: { type: "number" },
            activo_total: { type: "number" },
            pasivo_total: { type: "number" },
            utilidad_operacional: { type: "number" },
            gastos_financieros: { type: "number" },
            efectivo_generado_operacion: {
              type: "number",
              description: "Efectivo Generado por Actividades de Operación (EAO), solo si el documento trae un estado de flujos de efectivo",
            },
            efectivo_y_equivalentes: {
              type: "number",
              description: "Efectivo y equivalentes de efectivo al corte, solo si el documento lo detalla",
            },
            deuda_financiera: {
              type: "number",
              description: "Deuda financiera (obligaciones con bancos/leasing), distinta del pasivo total",
            },
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
