// Tipos y etiquetas del módulo Procesos (seguimiento de casos y controversias).

export type EtapaCaso =
  | "analisis"
  | "arreglo_directo"
  | "conciliacion"
  | "arbitraje"
  | "judicial"
  | "cerrado";

export type EstadoCaso = "activo" | "suspendido" | "cerrado";

export type EstadoCasoTarea = "pendiente" | "en_progreso" | "completada" | "descartada";

export type EstadoPrueba = "disponible" | "parcial" | "por_obtener" | "por_confirmar";

export type TipoCasoDocumento = "contrato" | "carta" | "oficio" | "poliza" | "acta" | "soporte" | "otro";

export interface Caso {
  id: string;
  titulo: string;
  cliente: string | null;
  contraparte: string | null;
  contrato: string | null;
  objeto: string | null;
  valor: number | null;
  entidad: string | null;
  etapa: EtapaCaso;
  estado: EstadoCaso;
  responsable: string | null;
  resumen: string | null;
  posicion: string | null;
  fecha_inicio: string | null;
  created_at: string;
  updated_at: string;
}

export interface CasoTarea {
  id: string;
  caso_id: string;
  orden: number | null;
  ante_quien: string | null;
  accion: string;
  proposito: string | null;
  fecha_limite: string | null;
  responsable: string | null;
  estado: EstadoCasoTarea;
  fecha_cumplimiento: string | null;
  soporte: string | null;
  created_at: string;
  updated_at: string;
}

export interface CasoHecho {
  id: string;
  caso_id: string;
  fecha: string | null;
  fecha_texto: string | null;
  hecho: string;
  relevancia: string | null;
  created_at: string;
}

export interface CasoPrueba {
  id: string;
  caso_id: string;
  hecho: string;
  prueba: string | null;
  fuente: string | null;
  estado: EstadoPrueba;
  created_at: string;
  updated_at: string;
}

export interface CasoDocumento {
  id: string;
  caso_id: string;
  nombre: string;
  tipo: TipoCasoDocumento;
  storage_path: string;
  tamano_bytes: number | null;
  content_type: string | null;
  created_at: string;
}

export const ETAPA_CASO_LABELS: Record<EtapaCaso, string> = {
  analisis: "Análisis",
  arreglo_directo: "Arreglo directo",
  conciliacion: "Conciliación",
  arbitraje: "Arbitraje",
  judicial: "Judicial",
  cerrado: "Cerrado",
};

export const ESTADO_CASO_LABELS: Record<EstadoCaso, string> = {
  activo: "Activo",
  suspendido: "Suspendido",
  cerrado: "Cerrado",
};

export const ESTADO_CASO_TAREA_LABELS: Record<EstadoCasoTarea, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Cumplida",
  descartada: "Descartada",
};

export const ESTADO_PRUEBA_LABELS: Record<EstadoPrueba, string> = {
  disponible: "Disponible",
  parcial: "Parcial",
  por_obtener: "Por obtener",
  por_confirmar: "Por confirmar",
};

export const TIPO_CASO_DOCUMENTO_LABELS: Record<TipoCasoDocumento, string> = {
  contrato: "Contrato",
  carta: "Carta",
  oficio: "Oficio",
  poliza: "Póliza",
  acta: "Acta",
  soporte: "Soporte",
  otro: "Otro",
};

/** Una tarea cuenta como abierta mientras no esté cumplida ni descartada. */
export function tareaAbierta(t: Pick<CasoTarea, "estado">): boolean {
  return t.estado === "pendiente" || t.estado === "en_progreso";
}
