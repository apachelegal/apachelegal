/**
 * Formatos oficiales de la EAAB tomados del paquete de la Invitación ICSM-1767-2025. Los archivos están
 * en el bucket "entidades" bajo la carpeta de la entidad; cada proceso puede ajustar los formatos, así
 * que al publicarse una invitación real hay que confirmar que sigan vigentes.
 */
export const PROCESO_FORMATOS = "ICSM-1767-2025";

export type EntregaFormato = "oferta" | "contrato" | "referencia";
export type GeneradoFormato = "formulario10";

export interface FormatoEaab {
  id: string;
  nombre: string;
  tipo: "formulario" | "anexo";
  /** Nombre del archivo en el almacenamiento. */
  archivo: string;
  entrega: EntregaFormato;
  /** Solo aplica a ciertos oferentes o casos. */
  condicion?: string;
  nota: string;
  /** Formato que la app puede diligenciar con los datos de la licitación. */
  generable?: GeneradoFormato;
  /** Pasa a la lista de entregables de la oferta. */
  obligatorio: boolean;
}

export const FORMATOS_EAAB: FormatoEaab[] = [
  { id: "F1", nombre: "Formulario 1. Carta de presentación de la oferta", tipo: "formulario", archivo: "FORMULARIO_1._CARTA_DE_PRESENTACIO_N_DE_LA_OFERTA.docx", entrega: "oferta", obligatorio: true, nota: "Firmada por el representante legal y abonada por un ingeniero civil (o sanitario) con tarjeta profesional. Aquí se declara si hay obras inconclusas; omitirlo vale 0 puntos." },
  { id: "F2", nombre: "Formulario 2. Autorización de tratamiento de datos personales", tipo: "formulario", archivo: "FORMULARIO_2._AUTORIZACIO_N_TRATAMIENTO_DATOS_PERSONALES.docx", entrega: "oferta", obligatorio: true, nota: "Uno por cada oferente o integrante." },
  { id: "F3", nombre: "Formulario 3. Compromiso anticorrupción y fraude", tipo: "formulario", archivo: "FORMULARIO_3._COMPROMISO_ANTICORRUPCIO_N_Y_FRAUDE.docx", entrega: "oferta", obligatorio: true, nota: "Incumplirlo es causal de rechazo. Cada integrante y el plural." },
  { id: "F4", nombre: "Formulario 4. Compromiso frente al Código de Integridad", tipo: "formulario", archivo: "FORMULARIO_4._COMPROMISO_FRENTE_AL_CO_DIGO_DE_INTEGRIDAD.docx", entrega: "oferta", obligatorio: true, nota: "Cada integrante y el plural." },
  { id: "F5", nombre: "Formulario 5. Certificado de parafiscales", tipo: "formulario", archivo: "FORMULARIO_5._CERTIFICADO_PARAFISCALES.docx", entrega: "oferta", obligatorio: true, nota: "Cuatro modelos según sea persona jurídica o natural, con o sin personal. Cubre los 6 meses anteriores al cierre; firma el revisor fiscal (con tarjeta profesional y antecedentes) o el representante legal." },
  { id: "F6", nombre: "Formulario 6. Beneficiario real", tipo: "formulario", archivo: "FORMULARIO_6._BENEFICIARIO_REAL.docx", entrega: "oferta", obligatorio: true, condicion: "Personas jurídicas", nota: "Firmado por el representante legal de cada persona jurídica." },
  { id: "F8", nombre: "Formulario 8. Cupo de crédito", tipo: "formulario", archivo: "FORMULARIO_8._CUPO_CRE_DITO.docx", entrega: "oferta", obligatorio: false, condicion: "Solo si la invitación exige cupo de crédito", nota: "Es donde más fallan los oferentes: debe ser en firme, no mayor a 30 días antes del cierre, con correo y teléfono de quien firma, por el 10 % del presupuesto y vigencia de 6 meses." },
  { id: "F9", nombre: "Formulario 9. Acreditación de emprendimiento y empresa de mujeres", tipo: "formulario", archivo: "FORMULARIO_9._ACREDITACIO_N_EMPRENDIMIENTO_Y_EMPRESA_DE_MUJERES.docx", entrega: "oferta", obligatorio: false, condicion: "Solo si se acredita", nota: "Da 2,5 puntos. No se puede subsanar." },
  { id: "F10", nombre: "Formulario 10. Requisitos técnicos y capacidad financiera", tipo: "formulario", archivo: "FORMULARIO_10._REQUISITOS_TE_CNICOS_Y_CAPAC.xlsx", entrega: "oferta", obligatorio: true, generable: "formulario10", nota: "Relaciona hasta 4 contratos, sus actividades y la información financiera de cada integrante. Solo cuenta el primer formulario 10; si el certificado y el formulario discrepan, prima el certificado." },
  { id: "F11A", nombre: "Formulario 11A. Requisitos habilitantes de oferentes extranjeros", tipo: "formulario", archivo: "FORMULARIO_11A._REQUISITOS_HABILITANTES_OFERENTES_EXTRANJEROS_SIN_DOMICILIO.docx", entrega: "oferta", obligatorio: false, condicion: "Oferentes extranjeros sin domicilio en Colombia", nota: "Firmado por el representante legal y un contador público colombiano." },
  { id: "F11B", nombre: "Formulario 11B. Clasificación UNSPSC de oferentes extranjeros", tipo: "formulario", archivo: "FORMULARIO_11B._CLASIFICACIO_N_UNSPSC_OFERENTES_EXTRANJEROS_SIN_DOMICILIO.docx", entrega: "oferta", obligatorio: false, condicion: "Oferentes extranjeros sin domicilio en Colombia", nota: "Acompaña al Formulario 11A." },
  { id: "A1", nombre: "Anexo 1. Referencia de obra (cantidades y precios oficiales)", tipo: "anexo", archivo: "ANEXO_1._REFERENCIA_OBRA.xlsx", entrega: "referencia", obligatorio: false, nota: "Los precios unitarios ofertados deben estar entre el 90 % y el 100 % del oficial de cada ítem." },
  { id: "A2", nombre: "Anexo 2. Condiciones técnicas particulares", tipo: "anexo", archivo: "ANEXO_2._CONDICIONES_TE_CNICAS_PARTICULARES.docx", entrega: "referencia", obligatorio: false, nota: "Especificaciones técnicas de la obra." },
  { id: "A3", nombre: "Anexo 3. Cronograma", tipo: "anexo", archivo: "ANEXO_3._CRONOGRAMA.pdf", entrega: "referencia", obligatorio: false, nota: "Fechas del proceso." },
  { id: "A4", nombre: "Anexo 4. Glosario", tipo: "anexo", archivo: "ANEXO_4._GLOSARIO.docx", entrega: "referencia", obligatorio: false, nota: "Definiciones del proceso." },
  { id: "A5", nombre: "Anexo 5. Minuta del contrato", tipo: "anexo", archivo: "ANEXO_5._MINUTA.docx", entrega: "referencia", obligatorio: false, nota: "Se revisa antes de ofertar: la oferta no admite salvedades ni condiciones." },
  { id: "A6", nombre: "Anexo 6. Matriz de riesgos", tipo: "anexo", archivo: "ANEXO_6._MATRI_Z_DE_RIESGOS.xlsx", entrega: "referencia", obligatorio: false, nota: "Distribución de riesgos entre la EAAB y el contratista." },
  { id: "A7", nombre: "Anexo 7. Plan estratégico de seguridad vial (PESV)", tipo: "anexo", archivo: "ANEXO_7._ANEXO_TE_CNICO_PLAN_ESTRATEGICO_DE_SEGURIDAD_VIAL___PESV.docx", entrega: "contrato", obligatorio: false, nota: "Se cumple al ejecutar el contrato." },
  { id: "A8J", nombre: "Anexo 8. Requisitos de seguridad y salud en el trabajo (persona jurídica)", tipo: "anexo", archivo: "ANEXO_8._REQUISITOS_SEGURIDAD_SALUD_TRABAJO_-_OBRAS_CIVILES____Persona_juri_dica_.docx", entrega: "contrato", obligatorio: false, condicion: "Personas jurídicas", nota: "Se cumple al ejecutar el contrato." },
  { id: "A8N", nombre: "Anexo 8. Requisitos de seguridad y salud en el trabajo (persona natural)", tipo: "anexo", archivo: "ANEXO_8._REQUISITOS_SEGURIDAD_SALUD_TRABAJO_-_OBRAS_CIVILES____Persona_natural_.docx", entrega: "contrato", obligatorio: false, condicion: "Personas naturales", nota: "Se cumple al ejecutar el contrato." },
  { id: "A9", nombre: "Anexo 9. Requisitos mínimos para la gestión predial", tipo: "anexo", archivo: "ANEXO_9._REQUISITOS_MI_NIMOS_PARA_LA_GESTIO_N_PREDIAL_DE_LA_EAAB-ESP.docx", entrega: "contrato", obligatorio: false, nota: "Se cumple al ejecutar el contrato." },
  { id: "A10", nombre: "Anexo 10. Requisitos de asistencia a la visita obligatoria", tipo: "anexo", archivo: "ANEXO_10._REQUISITOS_DE_ASISTENCIA_A_LA_VISITA_OBLIGATORIA.docx", entrega: "oferta", obligatorio: false, nota: "No asistir a la visita es causal de rechazo. Asiste un ingeniero civil o sanitario." },
];

export const ID_ENTIDAD_EAAB = "479d6efc-1482-4c79-b5e3-cb7b32e58262";

export function esEaab(lic: { entidad: string; entidad_id: string | null }): boolean {
  return lic.entidad_id === ID_ENTIDAD_EAAB || /acueducto y alcantarillado de bogot/i.test(lic.entidad);
}

export function rutaFormato(archivo: string): string {
  return `${ID_ENTIDAD_EAAB}/formatos/${PROCESO_FORMATOS}/${archivo}`;
}
