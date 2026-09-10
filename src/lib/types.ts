export type EstadoLicitacion =
  | "en_estudio"
  | "en_elaboracion"
  | "presentada"
  | "adjudicada"
  | "perdida"
  | "cancelada";

export type TipoDocumento = "pliego" | "propuesta" | "anexo" | "adenda" | "contrato" | "otro";

export interface Licitacion {
  id: string;
  entidad: string;
  entidad_id: string | null;
  objeto: string;
  numero_proceso: string | null;
  estado: EstadoLicitacion;
  presupuesto: number | null;
  fecha_apertura: string | null;
  fecha_cierre: string | null;
  fecha_vencimiento: string | null;
  responsable: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface Documento {
  id: string;
  licitacion_id: string;
  nombre: string;
  tipo: TipoDocumento;
  storage_path: string;
  tamano_bytes: number | null;
  content_type: string | null;
  subido_por: string | null;
  created_at: string;
}

export const ESTADO_LABELS: Record<EstadoLicitacion, string> = {
  en_estudio: "En estudio",
  en_elaboracion: "En elaboración",
  presentada: "Presentada",
  adjudicada: "Adjudicada",
  perdida: "Perdida",
  cancelada: "Cancelada",
};

export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  pliego: "Pliego",
  propuesta: "Propuesta",
  anexo: "Anexo",
  adenda: "Adenda / Aviso que modifica el pliego",
  contrato: "Contrato",
  otro: "Otro",
};

export type EstadoAnalisis = "pendiente" | "procesando" | "completado" | "error";

export interface RequisitoAnalisis {
  requisito: string;
  detalle?: string;
  fuente?: string;
}

export type UnidadIndicadorFinanciero = "absoluto" | "ratio" | "porcentaje";
export type ModoEvaluacionIndicador = "por_año" | "promedio" | "mas_reciente";

export interface TramoPuntajeIndicador {
  min?: number;
  max?: number;
  puntos: number;
  etiqueta?: string;
}

export interface IndicadorFinancieroRequisito {
  nombre: string;
  campo_base?: string;
  formula?: string;
  unidad: UnidadIndicadorFinanciero;
  tramos: TramoPuntajeIndicador[];
  ponderable_por_participacion: boolean;
  fuente?: string;
}

export interface RequisitosFinancierosEstructurado {
  indicadores: IndicadorFinancieroRequisito[];
  puntaje_minimo_total: number | null;
  modo_evaluacion: ModoEvaluacionIndicador;
  anios_evaluados: number | null;
  notas?: string;
}

export type TratamientoSubcontratista = "excluye" | "permite_con_reglas" | "permite";

export interface RequisitosTecnicosEstructurado {
  categorias_elegibles: string[];
  max_contratos: number | null;
  min_contratos_por_integrante: number | null;
  max_integrantes_forma_asociativa: number | null;
  valor_minimo_acumulado_smmlv: number | null;
  ventana_recencia_anios: number | null;
  tratamiento_subcontratista: TratamientoSubcontratista;
  reglas_subcontratista?: string;
  permite_experiencia_accionista_empresa_nueva: boolean;
  notas?: string;
}

export interface AnexoDetectado {
  nombre: string;
  descripcion?: string;
  obligatorio?: boolean;
}

export interface FechaClave {
  evento: string;
  fecha?: string;
}

export interface AnalisisResultado {
  resumen: string;
  requisitos_juridicos: RequisitoAnalisis[];
  requisitos_financieros: RequisitoAnalisis[];
  requisitos_tecnicos: RequisitoAnalisis[];
  requisitos_financieros_estructurado?: RequisitosFinancierosEstructurado | null;
  requisitos_tecnicos_estructurado?: RequisitosTecnicosEstructurado | null;
  anexos_detectados: AnexoDetectado[];
  fechas_clave: FechaClave[];
}

export interface AnalisisLicitacion {
  licitacion_id: string;
  estado: EstadoAnalisis;
  resumen: string | null;
  requisitos_juridicos: RequisitoAnalisis[] | null;
  requisitos_financieros: RequisitoAnalisis[] | null;
  requisitos_tecnicos: RequisitoAnalisis[] | null;
  requisitos_financieros_estructurado: RequisitosFinancierosEstructurado | null;
  requisitos_tecnicos_estructurado: RequisitosTecnicosEstructurado | null;
  anexos_detectados: AnexoDetectado[] | null;
  fechas_clave: FechaClave[] | null;
  error_mensaje: string | null;
  modelo: string | null;
  documentos_analizados: string[] | null;
  created_at: string;
  updated_at: string;
}

export type EstadoTarea = "pendiente" | "en_progreso" | "completada";

export interface Tarea {
  id: string;
  licitacion_id: string;
  titulo: string;
  responsable: string | null;
  fecha_limite: string | null;
  estado: EstadoTarea;
  origen: "manual" | "ia";
  created_at: string;
  updated_at: string;
}

export const ESTADO_TAREA_LABELS: Record<EstadoTarea, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
};

export interface ChecklistItem {
  id: string;
  licitacion_id: string;
  nombre: string;
  descripcion: string | null;
  obligatorio: boolean;
  completado: boolean;
  documento_id: string | null;
  origen: "manual" | "ia";
  created_at: string;
  updated_at: string;
}

export interface Empresa {
  id: string;
  nombre: string;
  nit: string | null;
  notas: string | null;
  registra_obras_inconclusas: boolean | null;
  es_empresa_mujeres: boolean | null;
  participa_licitaciones: boolean;
  ejecuta_obra: boolean;
  created_at: string;
  updated_at: string;
}

export interface IndicadorFinanciero {
  id: string;
  empresa_id: string;
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
  created_at: string;
  updated_at: string;
}

export type EstadoExperiencia = "ejecutado" | "liquidado" | "en_ejecucion";
export type VerificacionTitular =
  | "sin_verificar"
  | "contratista_directo"
  | "consorciado"
  | "subcontratista"
  | "no_coincide";

export interface Experiencia {
  id: string;
  empresa_id: string;
  entidad_contratante: string;
  numero_contrato: string | null;
  objeto: string;
  sector: string | null;
  valor: number | null;
  valor_original: number | null;
  moneda_original: string | null;
  valor_smmlv: number | null;
  participacion_pct: number | null;
  fecha_inicio: string | null;
  fecha_terminacion: string | null;
  estado: EstadoExperiencia;
  duracion_meses: number | null;
  codigo_unspsc: string | null;
  consecutivo_rup: string | null;
  detalles: Record<string, unknown> | null;
  origen_archivo: string | null;
  verificacion_titular: VerificacionTitular;
  verificacion_titular_nota: string | null;
  verificacion_titular_fecha: string | null;
  verificacion_titular_documento_id: string | null;
  created_at: string;
  updated_at: string;
}

export const ESTADO_EXPERIENCIA_LABELS: Record<EstadoExperiencia, string> = {
  ejecutado: "Ejecutado",
  liquidado: "Liquidado",
  en_ejecucion: "En ejecución",
};

export const VERIFICACION_TITULAR_LABELS: Record<VerificacionTitular, string> = {
  sin_verificar: "Sin verificar",
  contratista_directo: "Contratista directo",
  consorciado: "Consorciado",
  subcontratista: "Subcontratista",
  no_coincide: "Contratista no coincide",
};

export interface LicitacionParticipante {
  id: string;
  licitacion_id: string;
  empresa_id: string;
  porcentaje_participacion: number;
  created_at: string;
}

export type EstadoVerificacion = "pendiente" | "procesando" | "completado" | "error";
export type VeredictoCumplimiento = "si" | "no" | "parcial" | "no_determinable";

export interface RequisitoVerificado {
  categoria: "juridico" | "financiero" | "tecnico";
  requisito: string;
  cumple: VeredictoCumplimiento;
  justificacion: string;
  que_falta?: string;
}

export interface VerificacionCumplimiento {
  licitacion_id: string;
  estado: EstadoVerificacion;
  resumen: string | null;
  resultados: RequisitoVerificado[] | null;
  empresas_evaluadas: string[] | null;
  error_mensaje: string | null;
  modelo: string | null;
  created_at: string;
  updated_at: string;
}

export const VEREDICTO_LABELS: Record<VeredictoCumplimiento, string> = {
  si: "Cumple",
  no: "No cumple",
  parcial: "Cumple parcialmente",
  no_determinable: "No se puede determinar",
};

export type TipoEmpresaDocumento = "rup" | "camara_comercio" | "estados_financieros" | "otro";

export interface EmpresaDocumento {
  id: string;
  empresa_id: string;
  nombre: string;
  tipo: TipoEmpresaDocumento;
  storage_path: string;
  tamano_bytes: number | null;
  content_type: string | null;
  created_at: string;
}

export const TIPO_EMPRESA_DOCUMENTO_LABELS: Record<TipoEmpresaDocumento, string> = {
  rup: "RUP",
  camara_comercio: "Cámara de Comercio",
  estados_financieros: "Estados financieros",
  otro: "Otro",
};

export interface ExperienciaDocumento {
  id: string;
  experiencia_id: string;
  nombre: string;
  storage_path: string;
  tamano_bytes: number | null;
  content_type: string | null;
  created_at: string;
}

export interface ClasificacionRup {
  codigo: string;
  descripcion: string;
}

export interface ExperienciaRupFaltante {
  entidad_contratante: string;
  objeto: string;
  valor?: number;
  numero_contrato?: string;
  fecha_inicio?: string;
  fecha_terminacion?: string;
}

export interface EmpresaDatosJuridicos {
  empresa_id: string;
  representante_legal: string | null;
  tipo_documento_representante: string | null;
  numero_documento_representante: string | null;
  objeto_social: string | null;
  fecha_constitucion: string | null;
  duracion_sociedad: string | null;
  capital_social: number | null;
  matricula_mercantil: string | null;
  fecha_ultima_renovacion: string | null;
  clasificacion_rup: ClasificacionRup[] | null;
  experiencia_rup_faltante: ExperienciaRupFaltante[] | null;
  modelo: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntidadContratante {
  id: string;
  nombre: string;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManualContratacion {
  id: string;
  entidad_id: string;
  nombre: string;
  vigencia: string | null;
  storage_path: string;
  tamano_bytes: number | null;
  content_type: string | null;
  created_at: string;
}

export interface LicitacionExperienciaSeleccionada {
  id: string;
  licitacion_id: string;
  experiencia_id: string;
  justificacion: string | null;
  actividad_acreditada: string | null;
  origen: "ia" | "manual";
  created_at: string;
}
