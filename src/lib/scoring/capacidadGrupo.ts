import { createAdminClient } from "@/lib/supabase/admin";
import { valorASmmlv } from "./smmlv";
import type { Empresa, Experiencia, IndicadorFinanciero } from "@/lib/types";

/**
 * Contratos que, aunque están cargados, no deben usarse en los totales de
 * capacidad porque su valor no se ha verificado contra el certificado
 * original y es implausible frente a otros datos de la misma empresa.
 * Cada entrada debe tener una razón documentada — no es un filtro silencioso.
 */
const EXCLUSIONES_CONOCIDAS: Record<string, string> = {
  "c8e0db47-1445-4d8a-bc67-08094f533fbd":
    "Contrato EDP Gestión de la Producción de Energía SA (WES): 463,6 millones EUR es implausible frente al patrimonio de WES y a que la empresa necesitó socio financiero en EPM. Pendiente verificar certificado original.",
};

const PATRON_PTAR_PTAP = /PTAR|PTAP|planta de tratamiento|tratamiento de agua|potabiliz/i;

export interface CapacidadEmpresa {
  empresa: Empresa;
  sectores: { nombre: string; contratos: number }[];
  experienciaConfiableSmmlv: number;
  contratosConfiables: number;
  mayorContrato: { smmlv: number; entidad: string } | null;
  contratosExcluidosPorDatoFaltante: number;
  contratosConNotaCalidad: { entidad: string; nota: string }[];
  financierosUltimoAnio: IndicadorFinanciero | null;
}

function esConfiable(e: Experiencia): boolean {
  if (e.estado === "en_ejecucion") return false;
  if (e.verificacion_titular === "no_coincide") return false;
  if (e.participacion_pct == null) return false; // participación no documentada: no se asume 100%
  if (e.id in EXCLUSIONES_CONOCIDAS) return false;
  return true;
}

function smmlvDelContrato(e: Experiencia): number | null {
  if (e.valor_smmlv != null) return e.valor_smmlv;
  return valorASmmlv(e.valor, e.fecha_terminacion ?? e.fecha_inicio);
}

async function fetchEmpresasYExperienciaGrupo(): Promise<{ empresas: Empresa[]; experiencia: Experiencia[] }> {
  const supabase = createAdminClient();

  const { data: empresas } = await supabase
    .from("empresas")
    .select("*")
    .eq("categoria", "grupo")
    .order("nombre");

  const lista = ((empresas ?? []) as Empresa[]).filter((e) => !e.archivada);
  if (lista.length === 0) return { empresas: [], experiencia: [] };

  const ids = lista.map((e) => e.id);
  const { data: experiencia } = await supabase.from("experiencia").select("*").in("empresa_id", ids);

  return { empresas: lista, experiencia: (experiencia ?? []) as Experiencia[] };
}

export async function calcularCapacidadGrupo(): Promise<CapacidadEmpresa[]> {
  const supabase = createAdminClient();
  const { empresas: lista, experiencia } = await fetchEmpresasYExperienciaGrupo();
  if (lista.length === 0) return [];

  const ids = lista.map((e) => e.id);

  const { data: indicadores } = await supabase
    .from("indicadores_financieros")
    .select("*")
    .in("empresa_id", ids)
    .order("periodo", { ascending: false });

  const expPorEmpresa = new Map<string, Experiencia[]>();
  for (const e of experiencia) {
    (expPorEmpresa.get(e.empresa_id) ?? expPorEmpresa.set(e.empresa_id, []).get(e.empresa_id)!).push(e);
  }

  const indPorEmpresa = new Map<string, IndicadorFinanciero>();
  for (const i of (indicadores ?? []) as IndicadorFinanciero[]) {
    if (!indPorEmpresa.has(i.empresa_id)) indPorEmpresa.set(i.empresa_id, i);
  }

  return lista.map((empresa) => {
    const rows = expPorEmpresa.get(empresa.id) ?? [];

    const sectoresMap = new Map<string, number>();
    let experienciaConfiableSmmlv = 0;
    let contratosConfiables = 0;
    let contratosExcluidosPorDatoFaltante = 0;
    let mayorContrato: { smmlv: number; entidad: string } | null = null;
    const contratosConNotaCalidad: { entidad: string; nota: string }[] = [];

    for (const row of rows) {
      const sector = row.sector?.trim() || null;
      if (sector) sectoresMap.set(sector, (sectoresMap.get(sector) ?? 0) + 1);

      if (row.id in EXCLUSIONES_CONOCIDAS) {
        contratosConNotaCalidad.push({ entidad: row.entidad_contratante, nota: EXCLUSIONES_CONOCIDAS[row.id] });
      }

      if (!esConfiable(row)) {
        if (row.estado !== "en_ejecucion" && row.verificacion_titular !== "no_coincide") {
          contratosExcluidosPorDatoFaltante++;
        }
        continue;
      }

      const smmlv = smmlvDelContrato(row);
      if (smmlv == null) continue;

      const ponderado = smmlv * ((row.participacion_pct ?? 100) / 100);
      contratosConfiables++;
      experienciaConfiableSmmlv += ponderado;
      if (!mayorContrato || ponderado > mayorContrato.smmlv) {
        mayorContrato = { smmlv: ponderado, entidad: row.entidad_contratante };
      }
    }

    const sectores = [...sectoresMap.entries()]
      .map(([nombre, contratos]) => ({ nombre, contratos }))
      .sort((a, b) => b.contratos - a.contratos);

    return {
      empresa,
      sectores,
      experienciaConfiableSmmlv,
      contratosConfiables,
      mayorContrato,
      contratosExcluidosPorDatoFaltante,
      contratosConNotaCalidad,
      financierosUltimoAnio: indPorEmpresa.get(empresa.id) ?? null,
    };
  });
}

export interface ContratoPtarPtap {
  empresaNombre: string;
  entidad: string;
  objeto: string;
  tipo: "PTAR" | "PTAP" | "Sin clasificar";
  caudalLps: number | null;
  volumenM3: number | null;
  participacionPct: number | null;
  estado: string;
}

export interface CapacidadPtarPtap {
  totalContratos: number;
  conCapacidadDocumentada: ContratoPtarPtap[];
  sinCapacidadDocumentada: ContratoPtarPtap[];
  porEmpresa: { empresaNombre: string; total: number; conCapacidad: number }[];
}

function tipoPtarPtap(sector: string | null, objeto: string): "PTAR" | "PTAP" | "Sin clasificar" {
  const texto = `${sector ?? ""} ${objeto}`.toUpperCase();
  if (texto.includes("PTAR") || texto.includes("AGUAS RESIDUAL")) return "PTAR";
  if (texto.includes("PTAP") || texto.includes("POTABILIZ") || texto.includes("AGUA POTABLE")) return "PTAP";
  return "Sin clasificar";
}

function extraerVolumenM3(actividadesRelevantes: unknown): number | null {
  if (typeof actividadesRelevantes !== "string") return null;
  const m = actividadesRelevantes.match(/vol[uú]men de ([\d.,]+)\s*m3/i);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Busca, entre la experiencia del grupo, los contratos de PTAR/PTAP y separa
 * los que tienen capacidad física documentada (caudal en LPS, o volumen en m3
 * para plantas tipo lagunas de oxidación) de los que solo tienen el valor en
 * pesos cargado. Sirve para saber, ante un pliego que exija un caudal mínimo,
 * qué contratos ya sirven como soporte y cuáles requieren sacar el certificado
 * original para extraer la capacidad.
 */
export async function calcularExperienciaPtarPtap(): Promise<CapacidadPtarPtap> {
  const { empresas, experiencia } = await fetchEmpresasYExperienciaGrupo();
  const nombrePorEmpresa = new Map(empresas.map((e) => [e.id, e.nombre]));

  const conCapacidadDocumentada: ContratoPtarPtap[] = [];
  const sinCapacidadDocumentada: ContratoPtarPtap[] = [];
  const porEmpresaMap = new Map<string, { total: number; conCapacidad: number }>();

  for (const row of experiencia) {
    const sector = row.sector;
    const objeto = row.objeto ?? "";
    if (!PATRON_PTAR_PTAP.test(sector ?? "") && !PATRON_PTAR_PTAP.test(objeto)) continue;

    const empresaNombre = nombrePorEmpresa.get(row.empresa_id) ?? "?";
    const detalles = (row.detalles ?? {}) as Record<string, unknown>;
    const caudalLps = (detalles.caudal_lps as number) ?? (detalles.caudal_lps_total as number) ?? null;
    const volumenM3 = extraerVolumenM3(detalles.actividades_relevantes);

    const contrato: ContratoPtarPtap = {
      empresaNombre,
      entidad: row.entidad_contratante,
      objeto,
      tipo: tipoPtarPtap(sector, objeto),
      caudalLps,
      volumenM3,
      participacionPct: row.participacion_pct,
      estado: row.estado,
    };

    const stats = porEmpresaMap.get(empresaNombre) ?? { total: 0, conCapacidad: 0 };
    stats.total++;
    if (caudalLps != null || volumenM3 != null) {
      stats.conCapacidad++;
      conCapacidadDocumentada.push(contrato);
    } else {
      sinCapacidadDocumentada.push(contrato);
    }
    porEmpresaMap.set(empresaNombre, stats);
  }

  const porEmpresa = [...porEmpresaMap.entries()]
    .map(([empresaNombre, stats]) => ({ empresaNombre, ...stats }))
    .sort((a, b) => b.total - a.total);

  return {
    totalContratos: conCapacidadDocumentada.length + sinCapacidadDocumentada.length,
    conCapacidadDocumentada,
    sinCapacidadDocumentada,
    porEmpresa,
  };
}
