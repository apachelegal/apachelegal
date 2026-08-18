import Anthropic from "@anthropic-ai/sdk";
import type { ClasificacionRup, ExperienciaRupFaltante } from "@/lib/types";

const TOOL_NAME = "registrar_datos_juridicos";
const MODEL = "claude-sonnet-5";

export interface DatosJuridicosExtraidos {
  representante_legal?: string;
  tipo_documento_representante?: string;
  numero_documento_representante?: string;
  objeto_social?: string;
  fecha_constitucion?: string;
  duracion_sociedad?: string;
  capital_social?: number;
  matricula_mercantil?: string;
  fecha_ultima_renovacion?: string;
  clasificacion_rup: ClasificacionRup[];
  experiencia_rup_faltante: ExperienciaRupFaltante[];
}

export async function extraerDatosJuridicos(
  documentos: { nombre: string; base64: string }[],
  experienciaExistente: { entidad_contratante: string; objeto: string; fecha_terminacion: string | null }[],
): Promise<DatosJuridicosExtraidos> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const listaExperienciaExistente =
    experienciaExistente.length === 0
      ? "(no hay experiencia registrada en el sistema todavía)"
      : experienciaExistente
          .map((e, i) => `${i + 1}. ${e.entidad_contratante} — ${e.objeto}${e.fecha_terminacion ? ` (terminado ${e.fecha_terminacion})` : ""}`)
          .join("\n");

  const content: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "text",
      text: `Eres un abogado especializado en contratación estatal colombiana. A continuación se adjuntan el Certificado de Existencia y Representación Legal (Cámara de Comercio) y/o el RUP (Registro Único de Proponentes) de una empresa.

Usa la herramienta "${TOOL_NAME}" para registrar:

1. Datos jurídicos básicos (del Certificado de Cámara de Comercio):
   - Representante legal (nombre completo), tipo y número de documento de identidad
   - Objeto social (resumido)
   - Fecha de constitución de la sociedad
   - Duración de la sociedad (ej. "Indefinida" o la fecha de vencimiento)
   - Capital social (si se reporta)
   - Número de matrícula mercantil
   - Fecha de última renovación de la matrícula

2. Clasificación RUP: la lista de códigos y descripciones de clasificación (segmento/actividad UNSPSC) en los que la empresa está inscrita, tal como aparecen en el RUP.

3. Experiencia certificada en el RUP que falta registrar: el RUP incluye una lista de contratos acreditados como experiencia. A continuación está la lista de experiencia YA REGISTRADA en el sistema para esta empresa:

${listaExperienciaExistente}

Compara los contratos que aparecen certificados en el RUP contra esa lista (compara por entidad contratante y objeto, ignorando diferencias menores de redacción o mayúsculas). En "experiencia_rup_faltante" incluye ÚNICAMENTE los contratos que aparecen en el RUP pero que NO están ya en la lista registrada. No dupliques información. Si toda la experiencia del RUP ya está registrada, deja la lista vacía.

No inventes datos que no aparezcan en los documentos; si un campo no se encuentra, omítelo.`,
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
    max_tokens: 32000,
    tools: [
      {
        name: TOOL_NAME,
        description: "Registra los datos jurídicos, clasificación RUP y experiencia faltante de una empresa.",
        input_schema: {
          type: "object",
          properties: {
            representante_legal: { type: "string" },
            tipo_documento_representante: { type: "string" },
            numero_documento_representante: { type: "string" },
            objeto_social: { type: "string" },
            fecha_constitucion: { type: "string", description: "Formato YYYY-MM-DD" },
            duracion_sociedad: { type: "string" },
            capital_social: { type: "number" },
            matricula_mercantil: { type: "string" },
            fecha_ultima_renovacion: { type: "string", description: "Formato YYYY-MM-DD" },
            clasificacion_rup: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  codigo: { type: "string" },
                  descripcion: { type: "string" },
                },
                required: ["codigo", "descripcion"],
              },
            },
            experiencia_rup_faltante: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entidad_contratante: { type: "string" },
                  objeto: { type: "string" },
                  valor: { type: "number" },
                  numero_contrato: { type: "string" },
                  fecha_inicio: { type: "string", description: "Formato YYYY-MM-DD si se puede determinar" },
                  fecha_terminacion: { type: "string", description: "Formato YYYY-MM-DD si se puede determinar" },
                },
                required: ["entidad_contratante", "objeto"],
              },
            },
          },
          required: ["clasificacion_rup", "experiencia_rup_faltante"],
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
    throw new Error("La IA no devolvió datos jurídicos estructurados. Intenta de nuevo.");
  }

  if (message.stop_reason === "max_tokens") {
    throw new Error("Los documentos son demasiado extensos para procesarlos en una sola solicitud.");
  }

  return toolUse.input as DatosJuridicosExtraidos;
}
