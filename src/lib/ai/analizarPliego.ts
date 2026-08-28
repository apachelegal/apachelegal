import Anthropic from "@anthropic-ai/sdk";
import type { AnalisisResultado } from "@/lib/types";

const TOOL_NAME = "registrar_analisis";
const MODEL = "claude-sonnet-5";

const REQUISITO_SCHEMA = {
  type: "array" as const,
  items: {
    type: "object" as const,
    properties: {
      requisito: { type: "string", description: "Nombre corto del requisito" },
      detalle: { type: "string", description: "Explicación del requisito y cómo se debe acreditar" },
      fuente: { type: "string", description: "Documento y sección/página donde aparece" },
    },
    required: ["requisito"],
  },
};

export async function analizarDocumentos(
  documentos: { nombre: string; base64: string; esAdenda?: boolean }[],
  manuales: { nombre: string; base64: string }[] = [],
): Promise<AnalisisResultado> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const hayManuales = manuales.length > 0;
  const hayAdendas = documentos.some((d) => d.esAdenda);

  const content: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: `Eres un abogado especializado en contratación estatal colombiana (licitaciones públicas y procesos de selección). A continuación se adjuntan el pliego de condiciones de un proceso de licitación específico y, si aplica, sus anexos.${
        hayManuales
          ? ` También se adjunta el MANUAL DE CONTRATACIÓN GENERAL de la entidad (marcado como tal más abajo): contiene las reglas y procedimientos generales que aplican a todos los procesos de esa entidad. Úsalo como contexto de respaldo — si el pliego específico no menciona un requisito pero el manual general sí lo exige, inclúyelo citando el manual como fuente; si el pliego específico contradice o modifica el manual general, prevalece siempre el pliego específico.`
          : ""
      }${
        hayAdendas
          ? ` También se adjuntan una o más ADENDAS o AVISOS OFICIALES (marcados como tal más abajo con el prefijo "ADENDA/AVISO:") emitidos por la entidad DESPUÉS del pliego original, que pueden modificar fechas, requisitos u otras condiciones. Cuando una adenda/aviso contradiga o actualice algo del pliego original (por ejemplo, una nueva fecha para el mismo evento del cronograma), SIEMPRE prevalece la información de la adenda/aviso por ser posterior — usa la fecha o condición actualizada, no la original, y menciona en la fuente que proviene de la adenda/aviso correspondiente.`
          : ""
      }

Analiza todo el material y usa la herramienta "${TOOL_NAME}" para registrar:
- Un resumen ejecutivo del objeto, alcance y modalidad del proceso.
- Los requisitos jurídicos de habilitación (existencia y representación legal, RUP, garantías, inhabilidades, etc.).
- Los requisitos financieros (indicadores como capital de trabajo, liquidez, endeudamiento, patrimonio, experiencia en facturación, etc.).
- Los requisitos técnicos (experiencia específica, personal mínimo, equipos, certificaciones, especificaciones del objeto).
- Los anexos y formatos que el pliego exige diligenciar o adjuntar.
- Las fechas clave del cronograma del proceso (apertura, observaciones, cierre, adjudicación, etc.) si están indicadas.

Sé preciso y cita la fuente (nombre del documento, y sección o página si es identificable) de cada requisito. No inventes información que no esté en el texto; si un campo no aplica o no se encuentra, omítelo o indícalo como no especificado.

Para cada fecha clave, el campo "fecha" debe ser una única fecha exacta en formato YYYY-MM-DD, o debe omitirse por completo. Nunca escribas ahí un rango de fechas, una fecha relativa ("7 días después de...") ni ningún texto que no sea una fecha exacta; en esos casos deja el campo "fecha" sin diligenciar y pon la aclaración en el nombre del evento.`,
    },
    ...(hayManuales
      ? [
          {
            type: "text" as const,
            text: "--- MANUAL(ES) DE CONTRATACIÓN GENERAL DE LA ENTIDAD (contexto de respaldo) ---",
          },
          ...manuales.map((doc) => ({
            type: "document" as const,
            source: {
              type: "base64" as const,
              media_type: "application/pdf" as const,
              data: doc.base64,
            },
            title: `MANUAL GENERAL: ${doc.nombre.slice(0, 220)}`,
          })),
          {
            type: "text" as const,
            text: "--- PLIEGO DE CONDICIONES DEL PROCESO ESPECÍFICO Y SUS ANEXOS ---",
          },
        ]
      : []),
    ...documentos.map((doc) => ({
      type: "document" as const,
      source: {
        type: "base64" as const,
        media_type: "application/pdf" as const,
        data: doc.base64,
      },
      title: (doc.esAdenda ? `ADENDA/AVISO: ${doc.nombre}` : doc.nombre).slice(0, 240),
    })),
  ];

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    tools: [
      {
        name: TOOL_NAME,
        description:
          "Registra el análisis estructurado de un pliego de licitación y sus anexos.",
        input_schema: {
          type: "object",
          properties: {
            resumen: {
              type: "string",
              description: "Resumen ejecutivo del proceso en 4 a 8 líneas",
            },
            anexos_detectados: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nombre: { type: "string" },
                  descripcion: { type: "string" },
                  obligatorio: { type: "boolean" },
                },
                required: ["nombre"],
              },
            },
            fechas_clave: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  evento: { type: "string" },
                  fecha: {
                    type: "string",
                    description: "Fecha en formato YYYY-MM-DD si se puede determinar",
                  },
                },
                required: ["evento"],
              },
            },
            requisitos_juridicos: REQUISITO_SCHEMA,
            requisitos_financieros: REQUISITO_SCHEMA,
            requisitos_tecnicos: REQUISITO_SCHEMA,
          },
          required: [
            "resumen",
            "anexos_detectados",
            "fechas_clave",
            "requisitos_juridicos",
            "requisitos_financieros",
            "requisitos_tecnicos",
          ],
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
    throw new Error("La IA no devolvió un análisis estructurado. Intenta de nuevo.");
  }

  if (message.stop_reason === "max_tokens") {
    throw new Error(
      "El pliego es demasiado extenso y la respuesta de la IA se cortó antes de terminar. Intenta analizarlo con menos anexos a la vez.",
    );
  }

  return toolUse.input as AnalisisResultado;
}
