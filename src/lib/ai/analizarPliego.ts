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

const TRAMO_PUNTAJE_SCHEMA = {
  type: "object" as const,
  properties: {
    min: { type: "number", description: "Límite inferior del rango (inclusive). Omitir si no tiene piso." },
    max: { type: "number", description: "Límite superior del rango (exclusivo). Omitir si no tiene techo." },
    puntos: { type: "number" },
    etiqueta: { type: "string", description: "Descripción corta del rango tal como aparece en el pliego" },
  },
  required: ["puntos"],
};

const REQUISITOS_FINANCIEROS_ESTRUCTURADO_SCHEMA = {
  type: "object" as const,
  description:
    "SOLO si el pliego expresa el requisito financiero mediante indicadores con tramos/rangos de puntaje numéricos (ej. una tabla que asigna puntos según el rango en que cae el Capital de Trabajo, el Patrimonio, la Liquidez, etc.). Omite este campo por completo si el pliego es puramente cualitativo.",
  properties: {
    indicadores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "Nombre del indicador tal como lo llama el pliego" },
          campo_base: {
            type: "string",
            description:
              "Si el indicador corresponde a uno de estos conceptos estándar, indica cuál exactamente: patrimonio, capital_trabajo, activo_corriente, pasivo_corriente, activo_total, pasivo_total, utilidad_operacional, gastos_financieros, efectivo_generado_operacion, efectivo_y_equivalentes, deuda_financiera, ctn, indice_liquidez, indice_endeudamiento, rentabilidad_patrimonio, rentabilidad_activo, razon_cobertura_intereses, multiplo_deuda_neta. Si no coincide con ninguno, omite este campo y describe la fórmula en 'formula'.",
          },
          formula: { type: "string", description: "Descripción de la fórmula si no coincide con un campo_base estándar" },
          unidad: { type: "string", enum: ["absoluto", "ratio", "porcentaje"] },
          tramos: { type: "array", items: TRAMO_PUNTAJE_SCHEMA },
          ponderable_por_participacion: {
            type: "boolean",
            description: "Si en formas asociativas este indicador se combina ponderando por % de participación",
          },
          fuente: { type: "string" },
        },
        required: ["nombre", "unidad", "tramos", "ponderable_por_participacion"],
      },
    },
    puntaje_minimo_total: { type: "number" },
    modo_evaluacion: {
      type: "string",
      enum: ["por_año", "promedio", "mas_reciente"],
      description: "Si el puntaje mínimo se exige en cada año evaluado por separado, como promedio, o solo con el período más reciente",
    },
    anios_evaluados: { type: "number", description: "Cuántos últimos períodos fiscales exige el pliego (ej. 2)" },
    notas: { type: "string" },
  },
  required: ["indicadores", "modo_evaluacion"],
};

const REQUISITOS_TECNICOS_ESTRUCTURADO_SCHEMA = {
  type: "object" as const,
  description:
    "SOLO si el pliego expresa la experiencia habilitante mediante umbrales numéricos claros (valor mínimo acumulado, número máximo de contratos, ventana de años). Omite este campo por completo si el pliego es puramente cualitativo.",
  properties: {
    categorias_elegibles: {
      type: "array",
      items: { type: "string" },
      description: "Frases o palabras clave de los tipos de obra/actividad que el pliego acepta como experiencia elegible",
    },
    max_contratos: { type: "number" },
    min_contratos_por_integrante: {
      type: "number",
      description: "En formas asociativas, mínimo de contratos propios que cada integrante debe aportar",
    },
    max_integrantes_forma_asociativa: {
      type: "number",
      description: "Número máximo de integrantes que el pliego o el manual general permite en un consorcio/unión temporal, si lo limita explícitamente",
    },
    valor_minimo_acumulado_smmlv: { type: "number", description: "Valor mínimo exigido en SMMLV/SMLMV" },
    ventana_recencia_anios: { type: "number", description: "Años hacia atrás dentro de los cuales deben estar iniciados y terminados los contratos" },
    tratamiento_subcontratista: {
      type: "string",
      enum: ["excluye", "permite_con_reglas", "permite"],
      description: "Si el pliego prohíbe acreditar experiencia obtenida como subcontratista, la permite bajo condiciones específicas, o la permite sin restricción",
    },
    reglas_subcontratista: { type: "string", description: "Si es 'permite_con_reglas', describe exactamente esas condiciones" },
    permite_experiencia_accionista_empresa_nueva: {
      type: "boolean",
      description: "Si sociedades constituidas recientemente pueden acreditar experiencia de sus socios/accionistas",
    },
    notas: { type: "string" },
  },
  required: ["categorias_elegibles", "tratamiento_subcontratista", "permite_experiencia_accionista_empresa_nueva"],
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

Además de los requisitos en texto libre de arriba, si el pliego expresa los requisitos financieros y/o técnicos mediante umbrales numéricos y/o tablas de puntaje por rangos (por ejemplo, una tabla que asigna puntos según el rango en que cae un indicador financiero, un puntaje mínimo total exigido, un valor mínimo de experiencia en SMMLV/SMLMV, una ventana de años de recencia, o un número máximo/mínimo de contratos), registra TAMBIÉN esa misma información de forma estructurada en "requisitos_financieros_estructurado" y "requisitos_tecnicos_estructurado", complementando (nunca reemplazando) los arrays de texto libre. Si el pliego solo tiene requisitos cualitativos sin tramos/umbrales numéricos claros, omite estos dos campos por completo — no inventes tramos ni umbrales que el pliego no exprese explícitamente.

Si el pliego trae tablas de rangos financieros separadas para pesos colombianos (COP) y para dólares (USD) — normalmente porque la tabla en USD solo aplica cuando participan oferentes extranjeros junto con nacionales — extrae SIEMPRE los tramos y montos denominados en PESOS COLOMBIANOS (COP) en "requisitos_financieros_estructurado", ya que las empresas que se evalúan en este sistema son colombianas y reportan sus indicadores en COP. Menciona en "notas" que existe también una tabla en USD para el caso de oferentes extranjeros, sin registrar esa segunda tabla.

MUY IMPORTANTE sobre unidades en los indicadores "absoluto" (montos de dinero, como Capital de Trabajo o Patrimonio): los pliegos casi siempre imprimen estas tablas abreviadas en millones de pesos (ej. "2.652 MM" o "2.652.000" queriendo decir 2.652 millones). Los datos financieros de las empresas en este sistema están guardados en PESOS COMPLETOS, sin abreviar (ej. un patrimonio de $16.232 millones se guarda como 16232000000). Por lo tanto, en los campos "min"/"max" de cada tramo de un indicador "absoluto", registra SIEMPRE la cifra completa en pesos (multiplicando por 1.000.000 si el pliego la expresa en millones), nunca la cifra abreviada — de lo contrario cualquier comparación quedará mal escalada. Por ejemplo, si el pliego dice "Patrimonio < 16.232 (millones)" registra min/max como 16232000000, no como 16232. Esto NO aplica a los indicadores de tipo "ratio" o "porcentaje" (esos sí van en su escala normal, ej. 5 para 5%).

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
            requisitos_financieros_estructurado: REQUISITOS_FINANCIEROS_ESTRUCTURADO_SCHEMA,
            requisitos_tecnicos_estructurado: REQUISITOS_TECNICOS_ESTRUCTURADO_SCHEMA,
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
