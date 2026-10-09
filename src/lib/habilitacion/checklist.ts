import type { Empresa, EmpresaDocumento, Experiencia, TipoEmpresaDocumento, TipoPersona } from "@/lib/types";

/**
 * Lista de documentos de habilitación tomada de las Condiciones y Términos de la Invitación
 * ICSM-1767-2025 de la EAAB y del informe de evaluación real de ese proceso. Cada proceso puede
 * variar los detalles; esta lista es la base para tener la carpeta lista antes de que llegue uno.
 */

export type Carpeta = "juridica" | "financiera";

export type ReglaVigencia =
  /** La certificación debe haberse expedido máximo N días antes del cierre (ej. Cámara de Comercio: 30). */
  | { tipo: "max_dias_antes_cierre"; dias: number }
  /** Vigencia por fecha de vencimiento registrada (ej. RUP, que se renueva cada año). */
  | { tipo: "fecha_vencimiento" }
  /** Documento sin vencimiento propio (RUT, cédula, estados financieros ya cerrados). */
  | { tipo: "permanente" }
  /** Se emite nuevamente para cada proceso; el cargado es solo el último o un modelo. */
  | { tipo: "por_proceso" };

export interface ItemChecklistDef {
  tipo: TipoEmpresaDocumento;
  carpeta: Carpeta;
  label: string;
  ayuda: string;
  aplicaA: TipoPersona[];
  vigencia: ReglaVigencia;
}

export const ITEMS_CHECKLIST: ItemChecklistDef[] = [
  {
    tipo: "camara_comercio",
    carpeta: "juridica",
    label: "Certificado de existencia y representación legal",
    ayuda:
      "Expedido máximo 30 días calendario antes del cierre. Debe mostrar objeto social que permita ejecutar el contrato y duración de la sociedad no inferior al plazo del contrato + 1 año.",
    aplicaA: ["juridica"],
    vigencia: { tipo: "max_dias_antes_cierre", dias: 30 },
  },
  {
    tipo: "cedula_representante",
    carpeta: "juridica",
    label: "Documento de identidad del representante legal / oferente",
    ayuda: "Fotocopia legible. En persona natural, la cédula del oferente.",
    aplicaA: ["juridica", "natural"],
    vigencia: { tipo: "permanente" },
  },
  {
    tipo: "rut",
    carpeta: "juridica",
    label: "RUT",
    ayuda: "Copia del Registro Único Tributario, con el régimen de impuestos. Cada integrante de un plural lo aporta.",
    aplicaA: ["juridica", "natural"],
    vigencia: { tipo: "permanente" },
  },
  {
    tipo: "parafiscales",
    carpeta: "juridica",
    label: "Certificado de parafiscales y seguridad social (Formulario 5)",
    ayuda:
      "Pago de los 6 meses anteriores al cierre, firmado por el revisor fiscal (con tarjeta profesional y antecedentes disciplinarios) o por el representante legal. Se emite para cada proceso.",
    aplicaA: ["juridica", "natural"],
    vigencia: { tipo: "por_proceso" },
  },
  {
    tipo: "redam",
    carpeta: "juridica",
    label: "Certificado REDAM (deudores alimentarios morosos)",
    ayuda:
      "Del representante legal o de la persona natural. Si no se puede obtener, declaración juramentada explicando el motivo. Se emite para cada proceso.",
    aplicaA: ["juridica", "natural"],
    vigencia: { tipo: "por_proceso" },
  },
  {
    tipo: "beneficiario_real",
    carpeta: "juridica",
    label: "Beneficiario real (Formulario 6)",
    ayuda: "Formulario firmado por el representante legal. Se diligencia para cada proceso.",
    aplicaA: ["juridica"],
    vigencia: { tipo: "por_proceso" },
  },
  {
    tipo: "antecedentes",
    carpeta: "juridica",
    label: "Certificados de antecedentes (opcional)",
    ayuda:
      "La EAAB consulta en línea Contraloría, Procuraduría, Policía, RNMC y Personería de Bogotá. Solo los pide si no puede consultarlos; conviene tenerlos a mano para la subsanación.",
    aplicaA: ["juridica", "natural"],
    vigencia: { tipo: "por_proceso" },
  },
  {
    tipo: "rup",
    carpeta: "financiera",
    label: "RUP renovado y en firme",
    ayuda:
      "Debe estar renovado y en firme al cierre (art. 2.2.1.1.1.5.1 del Decreto 1082 de 2015). De aquí la EAAB toma la experiencia y los indicadores financieros. Registra la fecha de vencimiento para recibir alertas.",
    aplicaA: ["juridica", "natural"],
    vigencia: { tipo: "fecha_vencimiento" },
  },
  {
    tipo: "estados_financieros",
    carpeta: "financiera",
    label: "Estados financieros de los últimos 2 períodos",
    ayuda:
      "Con notas y firmas del representante legal y contador. Sirven de soporte de los indicadores cargados en la empresa.",
    aplicaA: ["juridica", "natural"],
    vigencia: { tipo: "permanente" },
  },
];

/** Los que cuentan para el porcentaje de preparación: documentos de la empresa con vigencia propia. */
export function esItemBase(def: ItemChecklistDef): boolean {
  return def.vigencia.tipo !== "por_proceso";
}

export type EstadoItem =
  | "ok"
  | "por_vencer"
  | "vencido"
  | "falta"
  /** Hay documento cargado pero sin la fecha necesaria para saber si está vigente. */
  | "verificar"
  /** Documento por proceso: se muestra el último cargado, sin juzgar vigencia. */
  | "por_proceso_cargado"
  | "por_proceso_falta";

export interface ItemEvaluado {
  def: ItemChecklistDef;
  estado: EstadoItem;
  detalle: string;
  documentos: EmpresaDocumento[];
}

const DIAS_ALERTA_VENCIMIENTO = 30;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizarCierre(valor: string | undefined | null): string {
  return valor && ISO.test(valor) ? valor : hoyISO();
}

function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(desde + "T00:00:00Z");
  const b = Date.parse(hasta + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

function fechaReferencia(doc: EmpresaDocumento): string {
  return doc.fecha_expedicion ?? doc.created_at.slice(0, 10);
}

function masReciente(docs: EmpresaDocumento[]): EmpresaDocumento | null {
  if (docs.length === 0) return null;
  return [...docs].sort((a, b) => fechaReferencia(b).localeCompare(fechaReferencia(a)))[0];
}

function formatoCorto(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function evaluarItem(def: ItemChecklistDef, docs: EmpresaDocumento[], cierre: string): ItemEvaluado {
  const documentos = [...docs].sort((a, b) => fechaReferencia(b).localeCompare(fechaReferencia(a)));
  const vigente = masReciente(docs);

  if (def.vigencia.tipo === "por_proceso") {
    if (!vigente) {
      return { def, estado: "por_proceso_falta", detalle: "Se prepara para cada licitación.", documentos };
    }
    const exp = vigente.fecha_expedicion;
    return {
      def,
      estado: "por_proceso_cargado",
      detalle: exp
        ? `Último cargado: expedido el ${formatoCorto(exp)}. Renovar para cada proceso.`
        : "Hay uno cargado sin fecha de expedición. Renovar para cada proceso.",
      documentos,
    };
  }

  if (!vigente) {
    return { def, estado: "falta", detalle: "No hay documento cargado.", documentos };
  }

  switch (def.vigencia.tipo) {
    case "permanente":
      return { def, estado: "ok", detalle: "Cargado.", documentos };

    case "max_dias_antes_cierre": {
      const exp = vigente.fecha_expedicion;
      if (!exp) {
        return {
          def,
          estado: "verificar",
          detalle: `Falta la fecha de expedición para saber si cumple los ${def.vigencia.dias} días antes del cierre.`,
          documentos,
        };
      }
      const edad = diasEntre(exp, cierre);
      if (edad < 0) {
        return {
          def,
          estado: "vencido",
          detalle: `Expedido el ${formatoCorto(exp)}, después del cierre de referencia (${formatoCorto(cierre)}).`,
          documentos,
        };
      }
      if (edad > def.vigencia.dias) {
        return {
          def,
          estado: "vencido",
          detalle: `Expedido el ${formatoCorto(exp)}: ${edad} días antes del cierre de referencia; se exigen máximo ${def.vigencia.dias}. Pedir uno nuevo.`,
          documentos,
        };
      }
      return {
        def,
        estado: "ok",
        detalle: `Expedido el ${formatoCorto(exp)}: ${edad} días antes del cierre de referencia (máximo ${def.vigencia.dias}).`,
        documentos,
      };
    }

    case "fecha_vencimiento": {
      const venc = vigente.fecha_vencimiento;
      if (!venc) {
        return {
          def,
          estado: "verificar",
          detalle: "Registra la fecha de vencimiento (renovación) para saber si estará vigente al cierre.",
          documentos,
        };
      }
      const margen = diasEntre(cierre, venc);
      if (margen < 0) {
        return {
          def,
          estado: "vencido",
          detalle: `Vence el ${formatoCorto(venc)}, antes del cierre de referencia (${formatoCorto(cierre)}). Renovar.`,
          documentos,
        };
      }
      if (margen < DIAS_ALERTA_VENCIMIENTO) {
        return {
          def,
          estado: "por_vencer",
          detalle: `Vence el ${formatoCorto(venc)}, ${margen} días después del cierre de referencia.`,
          documentos,
        };
      }
      return { def, estado: "ok", detalle: `Vigente hasta el ${formatoCorto(venc)}.`, documentos };
    }
  }
}

export interface ResumenTecnico {
  totalContratos: number;
  conCertificado: number;
  sinCertificado: number;
  enEjecucion: number;
  enEjecucionEaab: number;
  titularNoCoincide: number;
  titularSinVerificar: number;
}

const PATRON_EAAB = /eaab|acueducto y alcantarillado de bogot|acueducto de bogot/i;

export function resumirTecnica(experiencia: Experiencia[], experienciaIdsConCertificado: Set<string>): ResumenTecnico {
  const terminados = experiencia.filter((e) => e.estado !== "en_ejecucion");
  const enEjecucion = experiencia.filter((e) => e.estado === "en_ejecucion");
  return {
    totalContratos: terminados.length,
    conCertificado: terminados.filter((e) => experienciaIdsConCertificado.has(e.id)).length,
    sinCertificado: terminados.filter((e) => !experienciaIdsConCertificado.has(e.id)).length,
    enEjecucion: enEjecucion.length,
    enEjecucionEaab: enEjecucion.filter((e) => PATRON_EAAB.test(e.entidad_contratante)).length,
    titularNoCoincide: terminados.filter((e) => e.verificacion_titular === "no_coincide").length,
    titularSinVerificar: terminados.filter(
      (e) => experienciaIdsConCertificado.has(e.id) && (e.verificacion_titular ?? "sin_verificar") === "sin_verificar",
    ).length,
  };
}

export interface EstadoCarpeta {
  cierre: string;
  items: ItemEvaluado[];
  tecnica: ResumenTecnico;
  otros: EmpresaDocumento[];
  porcentajes: { juridica: number | null; financiera: number | null; tecnica: number | null; global: number | null };
  alertas: string[];
}

function porcentaje(ok: number, total: number): number | null {
  return total === 0 ? null : Math.round((ok / total) * 100);
}

export function evaluarCarpeta(
  empresa: Pick<Empresa, "tipo_persona">,
  documentos: EmpresaDocumento[],
  experiencia: Experiencia[],
  experienciaIdsConCertificado: Set<string>,
  cierre: string,
): EstadoCarpeta {
  const persona: TipoPersona = empresa.tipo_persona ?? "juridica";
  const aplicables = ITEMS_CHECKLIST.filter((d) => d.aplicaA.includes(persona));

  const items = aplicables.map((def) =>
    evaluarItem(def, documentos.filter((d) => d.tipo === def.tipo), cierre),
  );
  const tiposConItem = new Set(aplicables.map((d) => d.tipo));
  const otros = documentos.filter((d) => !tiposConItem.has(d.tipo));

  const base = items.filter((i) => esItemBase(i.def));
  const porCarpeta = (c: Carpeta) => {
    const lista = base.filter((i) => i.def.carpeta === c);
    return porcentaje(lista.filter((i) => i.estado === "ok").length, lista.length);
  };

  const tecnica = resumirTecnica(experiencia, experienciaIdsConCertificado);
  const pctTecnica = porcentaje(tecnica.conCertificado, tecnica.totalContratos);
  const pctJuridica = porCarpeta("juridica");
  const pctFinanciera = porCarpeta("financiera");

  const partes = [pctJuridica, pctFinanciera, pctTecnica].filter((p): p is number => p != null);
  const global = partes.length ? Math.round(partes.reduce((a, b) => a + b, 0) / partes.length) : null;

  const alertas: string[] = [];
  for (const i of items) {
    if (i.estado === "vencido") alertas.push(`${i.def.label}: vencido. ${i.detalle}`);
    else if (i.estado === "por_vencer") alertas.push(`${i.def.label}: por vencer. ${i.detalle}`);
    else if (i.estado === "falta") alertas.push(`${i.def.label}: falta.`);
    else if (i.estado === "verificar") alertas.push(`${i.def.label}: ${i.detalle}`);
  }
  if (tecnica.enEjecucionEaab >= 4) {
    alertas.push(
      `${tecnica.enEjecucionEaab} contratos en ejecución con la EAAB registrados: con 4 o más la EAAB rechaza la oferta.`,
    );
  }

  return {
    cierre,
    items,
    tecnica,
    otros,
    porcentajes: { juridica: pctJuridica, financiera: pctFinanciera, tecnica: pctTecnica, global },
    alertas,
  };
}
