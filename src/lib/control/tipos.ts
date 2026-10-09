import type { ActividadExtraida } from "@/lib/eaab/criterios";
import type { ActividadRequerida, ReglasPluralEaab, RequisitosFinancierosEstructurado } from "@/lib/types";

/** Tipos del control de socios. Todo es serializable para pasar del servidor al simulador del navegador. */

export interface EmpresaCtl {
  id: string;
  nombre: string;
  nit: string | null;
  categoria: "grupo" | "socio_potencial";
  tipoPersona: "juridica" | "natural";
}

export interface IndicadorCtl {
  periodo: string;
  patrimonio: number | null;
  activoCorriente: number | null;
  pasivoCorriente: number | null;
  activoTotal: number | null;
  pasivoTotal: number | null;
  utilidadOperacional: number | null;
  gastosFinancieros: number | null;
}

/** Palabras del objeto del contrato que sugieren una actividad, cuando no hay cantidades certificadas. */
export interface PistasCtl {
  metalica: boolean;
  sinZanja: boolean;
  estructuras: boolean;
  pavimento: boolean;
}

export interface ContratoCtl {
  id: string;
  empresaId: string;
  entidad: string;
  objeto: string;
  sector: string | null;
  consecutivo: string | null;
  smmlv: number | null;
  part: number | null;
  fecha: string | null;
  estado: string;
  titular: string;
  aportadaPorSocio: boolean;
  /** Interventoría o consultoría: no es experiencia de construcción. */
  soloSupervision: boolean;
  participacionDudosa: boolean;
  /** Las cantidades salen de una extracción con IA que nadie ha revisado. */
  iaSinRevisar: boolean;
  certificado: boolean;
  actividades: ActividadExtraida[];
  pistas: PistasCtl;
  /** Solo en escenarios: nombre de la empresa de la que se tomaría prestado este contrato por una relación de control hipotética. */
  viaControl?: string;
  /** Quién aporta el contrato según el RUP cuando lo reporta un accionista, socio o constituyente. */
  aportante?: string | null;
  /** Id de otro contrato cargado que es el mismo (el RUP de dos empresas reporta el mismo contrato). */
  duplicaDe?: string | null;
}

export interface ProcesoCtl {
  id: string;
  etiqueta: string;
  estado: string;
  presupuesto: number | null;
  reglas: ReglasPluralEaab;
  finReq: RequisitosFinancierosEstructurado;
  actividades: ActividadRequerida[];
  /** Tipos de obra que el pliego acepta como experiencia (acueducto, tubería, pavimento…). */
  categorias: string[];
  smmlvMin: number | null;
  maxContratos: number;
  ventanaAnios: number;
  maxIntegrantes: number | null;
  equipoActual: { empresaId: string; pct: number }[];
}

export type EstadoRup = "vigente" | "por_vencer" | "vencido" | "sin_rup" | "sin_fecha";

export interface ResumenEmpresaCtl {
  habilitacion: number | null;
  rupVence: string | null;
  rupEstado: EstadoRup;
  vinculadas: string[];
}

export interface DatosControl {
  hoy: string;
  empresas: EmpresaCtl[];
  indicadores: Record<string, IndicadorCtl | null>;
  contratos: ContratoCtl[];
  procesos: ProcesoCtl[];
  resumen: Record<string, ResumenEmpresaCtl>;
}

export interface Miembro {
  empresaId: string;
  pct: number;
}
