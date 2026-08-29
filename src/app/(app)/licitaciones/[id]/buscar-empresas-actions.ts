"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { evaluarEmpresas, type EmpresaScoringInput, type IndicadorFinancieroInput } from "@/lib/scoring";
import type { Experiencia, RequisitosFinancierosEstructurado, RequisitosTecnicosEstructurado } from "@/lib/types";
import { agregarParticipante } from "./participantes-actions";

export async function buscarEmpresasRecomendadas(licitacionId: string) {
  const supabase = createAdminClient();

  const { data: analisis, error: analisisError } = await supabase
    .from("analisis_licitacion")
    .select("requisitos_financieros_estructurado, requisitos_tecnicos_estructurado, estado")
    .eq("licitacion_id", licitacionId)
    .maybeSingle();

  if (analisisError) throw new Error(analisisError.message);
  if (!analisis || analisis.estado !== "completado") {
    throw new Error("Analiza el pliego con IA antes de buscar empresas recomendadas.");
  }

  const requisitosFinancieros = analisis.requisitos_financieros_estructurado as RequisitosFinancierosEstructurado | null;
  const requisitosTecnicos = analisis.requisitos_tecnicos_estructurado as RequisitosTecnicosEstructurado | null;

  if (!requisitosFinancieros || !requisitosTecnicos) {
    throw new Error(
      "Vuelve a analizar con IA para generar los datos estructurados de requisitos financieros y técnicos: este pliego se analizó antes de que la app supiera extraerlos, o el pliego no expresa umbrales numéricos claros.",
    );
  }

  const { data: empresas, error: empresasError } = await supabase.from("empresas").select("id, nombre").order("nombre");
  if (empresasError) throw new Error(empresasError.message);
  if (!empresas || empresas.length === 0) {
    return { individuales: [], grupos: [] };
  }

  const empresaIds = empresas.map((e) => e.id);

  const [{ data: experiencia, error: expError }, { data: indicadores, error: indError }] = await Promise.all([
    supabase.from("experiencia").select("*").in("empresa_id", empresaIds),
    supabase.from("indicadores_financieros").select("*").in("empresa_id", empresaIds),
  ]);

  if (expError) throw new Error(expError.message);
  if (indError) throw new Error(indError.message);

  const inputs: EmpresaScoringInput[] = empresas.map((empresa) => {
    const indicadoresPorAnio = new Map<string, IndicadorFinancieroInput>();
    for (const ind of indicadores ?? []) {
      if (ind.empresa_id !== empresa.id) continue;
      indicadoresPorAnio.set(ind.periodo, {
        patrimonio: ind.patrimonio,
        capital_trabajo: ind.capital_trabajo,
        activo_corriente: ind.activo_corriente,
        pasivo_corriente: ind.pasivo_corriente,
        activo_total: ind.activo_total,
        pasivo_total: ind.pasivo_total,
        utilidad_operacional: ind.utilidad_operacional,
        gastos_financieros: ind.gastos_financieros,
        efectivo_generado_operacion: ind.efectivo_generado_operacion,
        efectivo_y_equivalentes: ind.efectivo_y_equivalentes,
        deuda_financiera: ind.deuda_financiera,
        indice_liquidez: ind.indice_liquidez,
        indice_endeudamiento: ind.indice_endeudamiento,
        rentabilidad_patrimonio: ind.rentabilidad_patrimonio,
        rentabilidad_activo: ind.rentabilidad_activo,
        razon_cobertura_intereses: ind.razon_cobertura_intereses,
      });
    }

    return {
      empresaId: empresa.id,
      nombre: empresa.nombre,
      experiencia: ((experiencia ?? []) as Experiencia[]).filter((e) => e.empresa_id === empresa.id),
      indicadoresPorAnio,
    };
  });

  return evaluarEmpresas(inputs, requisitosFinancieros, requisitosTecnicos);
}

export async function agregarGrupoComoParticipantes(
  licitacionId: string,
  integrantes: { empresaId: string; porcentaje: number }[],
) {
  for (const { empresaId, porcentaje } of integrantes) {
    const formData = new FormData();
    formData.set("empresa_id", empresaId);
    formData.set("porcentaje_participacion", String(Math.round(porcentaje)));
    await agregarParticipante(licitacionId, formData);
  }
}
