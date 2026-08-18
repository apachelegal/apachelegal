import Anthropic from "@anthropic-ai/sdk";

const TOOL_NAME = "registrar_detalles";
const MODEL = "claude-sonnet-5";

export interface ActividadDetalle {
  descripcion: string;
  cantidad: number;
  unidad: string;
}

export interface DetallesExperienciaExtraidos {
  actividades: ActividadDetalle[];
  notas: string | null;
}

export async function extraerDetallesExperiencia(
  contexto: { entidad_contratante: string; objeto: string },
  documentos: { nombre: string; base64: string }[],
): Promise<DetallesExperienciaExtraidos> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const content: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: `Eres un ingeniero especializado en revisar certificados y actas de contratos de obra pública colombiana. A continuación se adjunta el certificado/acta de un contrato ya registrado como experiencia de una empresa:

- Entidad contratante: ${contexto.entidad_contratante}
- Objeto: ${contexto.objeto}

Lee el documento y extrae TODAS las cantidades técnicas medibles que el certificado acredite y que sirvan para comparar contra los requisitos técnicos de futuras licitaciones — por ejemplo (sin limitarte a esta lista, depende de lo que realmente diga el documento):
- Capacidad de estaciones de bombeo (l/s)
- Capacidad de tanques de almacenamiento (m3)
- Longitud de tuberías instaladas (metros) y su diámetro (pulgadas o mm) y material (HD, AC, HA, WSP, CCP, PVC, etc.)
- Área construida o intervenida (m2)
- Cualquier otra cantidad de obra ejecutada que el documento certifique explícitamente con una unidad de medida

Para cada cantidad que identifiques, regístrala como una actividad con su descripción, cantidad numérica y unidad. NO inventes cifras que no estén explícitamente en el documento — si el documento no certifica cantidades medibles, devuelve una lista vacía y explica en "notas" por qué (por ejemplo, si el documento es solo una carta de terminación sin detalle técnico). En "notas" también aclara cualquier ambigüedad relevante (por ejemplo si una cantidad está expresada por tramos y hay que sumarlos, o si el documento certifica actividades para varios frentes de obra).

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
    max_tokens: 8000,
    tools: [
      {
        name: TOOL_NAME,
        description: "Registra las cantidades técnicas certificadas en el documento de experiencia.",
        input_schema: {
          type: "object",
          properties: {
            actividades: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  descripcion: { type: "string" },
                  cantidad: { type: "number" },
                  unidad: { type: "string" },
                },
                required: ["descripcion", "cantidad", "unidad"],
              },
            },
            notas: { type: "string" },
          },
          required: ["actividades"],
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
    throw new Error("La IA no devolvió detalles estructurados. Intenta de nuevo.");
  }

  if (message.stop_reason === "max_tokens") {
    throw new Error("El documento es demasiado extenso para procesarlo en una sola solicitud.");
  }

  const raw = toolUse.input as { actividades: ActividadDetalle[] | string; notas?: string };
  const actividades = typeof raw.actividades === "string" ? JSON.parse(raw.actividades) : raw.actividades;

  if (!Array.isArray(actividades)) {
    throw new Error("La IA no devolvió las actividades en el formato esperado. Intenta de nuevo.");
  }

  return { actividades, notas: raw.notas ?? null };
}
