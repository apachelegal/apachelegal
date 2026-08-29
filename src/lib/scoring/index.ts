import type { RequisitosFinancierosEstructurado, RequisitosTecnicosEstructurado } from "@/lib/types";
import { evaluarEmpresaIndividual, sugerirGruposConsorcio } from "./consorcios";
import type { EmpresaScoringInput, GrupoConsorcioSugerido, ResultadoEmpresaIndividual } from "./tipos";

export * from "./tipos";
export * from "./financiero";
export * from "./tecnico";
export * from "./consorcios";

export function evaluarEmpresas(
  empresas: EmpresaScoringInput[],
  requisitosFinancieros: RequisitosFinancierosEstructurado,
  requisitosTecnicos: RequisitosTecnicosEstructurado,
): { individuales: ResultadoEmpresaIndividual[]; grupos: GrupoConsorcioSugerido[] } {
  const individuales = empresas
    .map((e) => evaluarEmpresaIndividual(e, requisitosFinancieros, requisitosTecnicos))
    .sort((a, b) => Number(b.veredicto === "cumple") - Number(a.veredicto === "cumple"));

  const grupos = sugerirGruposConsorcio(empresas, requisitosFinancieros, requisitosTecnicos);

  return { individuales, grupos };
}
