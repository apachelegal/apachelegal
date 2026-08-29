/**
 * Salario Mínimo Mensual Legal Vigente (SMLMV/SMMLV) por año en Colombia, en pesos.
 * Se usa para convertir el valor de un contrato a SMLMV cuando el registro no trae ya
 * `valor_smmlv` calculado (ej. importaciones antiguas o experiencia de empresas cuyo dato
 * base solo se cargó en pesos) — mismo criterio que exigen los pliegos: "el valor de cada
 * contrato se calcula con base en el SMLMV vigente en el año de su terminación".
 */
export const SMLMV_POR_ANIO: Record<number, number> = {
  2001: 286000,
  2002: 309000,
  2003: 332000,
  2004: 358000,
  2005: 381500,
  2006: 408000,
  2007: 433700,
  2008: 461500,
  2009: 496900,
  2010: 515000,
  2011: 535600,
  2012: 566700,
  2013: 589500,
  2014: 616000,
  2015: 644350,
  2016: 689455,
  2017: 737717,
  2018: 781242,
  2019: 828116,
  2020: 877803,
  2021: 908526,
  2022: 1000000,
  2023: 1160000,
  2024: 1300000,
  2025: 1423500,
  2026: 1423500, // aún no publicado a la fecha de este análisis; se usa el último conocido
};

export function smlmvDelAnio(anio: number): number | null {
  return SMLMV_POR_ANIO[anio] ?? null;
}

/** Convierte un valor en pesos a SMLMV usando el año de terminación del contrato. */
export function valorASmmlv(valorPesos: number | null, fechaTerminacion: string | null): number | null {
  if (valorPesos == null || !fechaTerminacion) return null;
  const anio = new Date(fechaTerminacion).getFullYear();
  const smlmv = smlmvDelAnio(anio);
  if (smlmv == null) return null;
  return valorPesos / smlmv;
}
