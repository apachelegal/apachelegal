import type { Experiencia, TramoPuntajeIndicador } from "@/lib/types";

export interface ResultadoIndicador {
  nombre: string;
  valor: number | null;
  puntos: number;
  tramo: TramoPuntajeIndicador | null;
}

export interface ResultadoFinancieroAnio {
  periodo: string;
  puntajeTotal: number;
  detalle: ResultadoIndicador[];
  cumple: boolean;
}

export interface ResultadoTecnico {
  valorSmmlvElegible: number;
  contratosElegibles: Experiencia[];
  contratosExcluidos: { experiencia: Experiencia; motivo: string }[];
  cumpleMinimo: boolean;
}

export interface ResultadoEmpresaIndividual {
  empresaId: string;
  nombre: string;
  tecnico: ResultadoTecnico;
  financiero: ResultadoFinancieroAnio[];
  cumpleTecnico: boolean;
  cumpleFinanciero: boolean;
  veredicto: "cumple" | "no_cumple" | "sin_datos";
}

export interface IntegranteConsorcioSugerido {
  empresaId: string;
  nombre: string;
  porcentaje: number;
}

export interface GrupoConsorcioSugerido {
  integrantes: IntegranteConsorcioSugerido[];
  experienciaResultanteSmmlv: number;
  financieroResultantePorAnio: ResultadoFinancieroAnio[];
  factible: boolean;
  motivoNoFactible?: string;
}

export interface EmpresaScoringInput {
  empresaId: string;
  nombre: string;
  experiencia: Experiencia[];
  indicadoresPorAnio: Map<string, IndicadorFinancieroInput>;
}

export interface IndicadorFinancieroInput {
  patrimonio: number | null;
  capital_trabajo: number | null;
  activo_corriente: number | null;
  pasivo_corriente: number | null;
  activo_total: number | null;
  pasivo_total: number | null;
  utilidad_operacional: number | null;
  gastos_financieros: number | null;
  efectivo_generado_operacion: number | null;
  efectivo_y_equivalentes: number | null;
  deuda_financiera: number | null;
  indice_liquidez: number | null;
  indice_endeudamiento: number | null;
  rentabilidad_patrimonio: number | null;
  rentabilidad_activo: number | null;
  razon_cobertura_intereses: number | null;
}
