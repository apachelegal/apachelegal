import Anthropic from "@anthropic-ai/sdk";

const TOOL_NAME = "registrar_detalles";
const MODEL = "claude-sonnet-5";

export type CategoriaActividad =
  | "tuberia_presion"
  | "tuberia_gravedad"
  | "camara_o_estructura_concreto"
  | "pavimento"
  | "reparacion_puntual"
  | "estacion_bombeo"
  | "tanque"
  | "otro";

export type MetodoInstalacion = "zanja_abierta" | "sin_zanja" | "no_especificado";

export interface ActividadDetalle {
  descripcion: string;
  cantidad: number;
  unidad: string;
  /** Campos opcionales para poder comparar contra requisitos de pliegos con cantidades por actividad. */
  categoria?: CategoriaActividad;
  material?: string;
  diametro_pulgadas?: number;
  metodo_instalacion?: MetodoInstalacion;
  /** Espesor en metros, cuando la actividad es pavimento y el certificado lo indica. */
  espesor_m?: number;
}

export interface DetallesExperienciaExtraidos {
  actividades: ActividadDetalle[];
  notas: string | null;
}

export async function extraerDetallesExperiencia(
  contexto: { entidad_contratante: string; objeto: string },
  documentos: { nombre: string; base64: string; textoOcr?: string | null }[],
  opciones: { soloRelevantesAcueducto?: boolean } = {},
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
- Volumen de concreto (m3) en estructuras: cámaras o cajas de válvulas, tanques, atraques, pantallas, box culvert
- Pavimento rígido o flexible (m3 o m2, y espesor si se indica)
- Número de reparaciones o daños puntuales en tuberías, con su material y diámetro
- Tramos instalados SIN ZANJA (hincado, microtúnel, túnel liner, perforación dirigida, ramming) y su longitud y diámetro
- Cualquier otra cantidad de obra ejecutada que el documento certifique explícitamente con una unidad de medida

Para cada cantidad que identifiques, regístrala como una actividad con su descripción, cantidad numérica y unidad. Cuando el documento lo permita, clasifícala además: "categoria" (tuberia_presion si conduce fluido a presión como acueducto o impulsión; tuberia_gravedad si es alcantarillado o pluvial; camara_o_estructura_concreto; pavimento; reparacion_puntual; estacion_bombeo; tanque; otro), "material", "diametro_pulgadas" (convierte mm a pulgadas si hace falta) y "metodo_instalacion" (zanja_abierta, sin_zanja o no_especificado). Si el certificado no dice el método, usa no_especificado: no lo asumas. Si un mismo tramo tiene varios diámetros, registra una actividad por diámetro. NO inventes cifras que no estén explícitamente en el documento — si el documento no certifica cantidades medibles, devuelve una lista vacía y explica en "notas" por qué (por ejemplo, si el documento es solo una carta de terminación sin detalle técnico). En "notas" también aclara cualquier ambigüedad relevante (por ejemplo si una cantidad está expresada por tramos y hay que sumarlos, o si el documento certifica actividades para varios frentes de obra).

${
        opciones.soloRelevantesAcueducto
          ? `MODO ENFOCADO: registra ÚNICAMENTE las actividades de estas categorías y omite todo lo demás (demoliciones, acabados, pintura, carpintería, señalización, excavaciones, rellenos, etc.): tuberías (a presión o de gravedad) de diámetro >= 8 pulgadas, tramos sin zanja, cámaras o cajas de válvulas y estructuras de concreto (tanques, atraques, pantallas, box culvert) con su volumen de concreto en m3, pavimento (rígido o flexible), reparaciones o daños puntuales en tuberías, estaciones de bombeo y tanques. Para las estructuras de concreto suma los volúmenes por estructura solo si el documento los da así; no inventes totales.`
          : ""
      }

Usa la herramienta "${TOOL_NAME}" para registrar el resultado.`,
    },
    ...documentos.flatMap((doc): Anthropic.Messages.ContentBlockParam[] => [
      {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: doc.base64,
        },
        title: doc.nombre.slice(0, 240),
      },
      ...(doc.textoOcr
        ? [
            {
              type: "text" as const,
              text: `Texto leído por OCR del documento «${doc.nombre}» (las filas de tablas van separadas por « | » y las líneas dudosas llevan [?]). El OCR puede confundir puntos, comas y dígitos: ante cualquier diferencia entre este texto y la imagen del PDF, manda la imagen.\n\n${doc.textoOcr}`,
            },
          ]
        : []),
    ]),
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
                  categoria: {
                    type: "string",
                    enum: [
                      "tuberia_presion",
                      "tuberia_gravedad",
                      "camara_o_estructura_concreto",
                      "pavimento",
                      "reparacion_puntual",
                      "estacion_bombeo",
                      "tanque",
                      "otro",
                    ],
                  },
                  material: { type: "string" },
                  diametro_pulgadas: { type: "number" },
                  metodo_instalacion: { type: "string", enum: ["zanja_abierta", "sin_zanja", "no_especificado"] },
                  espesor_m: { type: "number" },
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
