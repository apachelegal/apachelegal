"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarCumplimiento, type EmpresaContexto } from "@/lib/ai/verificarCumplimiento";
import type { RequisitoAnalisis } from "@/lib/types";

export async function verificarCumplimientoAction(licitacionId: string) {
  const supabase = createAdminClient();

  const [{ data: analisis, error: analisisError }, { data: participantes, error: partError }] =
    await Promise.all([
      supabase
        .from("analisis_licitacion")
        .select("requisitos_juridicos, requisitos_financieros, requisitos_tecnicos, estado")
        .eq("licitacion_id", licitacionId)
        .maybeSingle(),
      supabase
        .from("licitacion_participantes")
        .select("empresa_id, porcentaje_participacion, empresas(nombre, registra_obras_inconclusas, es_empresa_mujeres)")
        .eq("licitacion_id", licitacionId),
    ]);

  if (analisisError) throw new Error(analisisError.message);
  if (partError) throw new Error(partError.message);

  if (!analisis || analisis.estado !== "completado") {
    throw new Error("Analiza el pliego con IA antes de verificar el cumplimiento.");
  }
  if (!participantes || participantes.length === 0) {
    throw new Error("Agrega al menos una empresa participante antes de verificar el cumplimiento.");
  }

  const empresaIds = participantes.map((p) => p.empresa_id);

  const [{ data: indicadores, error: indError }, { data: experiencia, error: expError }] =
    await Promise.all([
      supabase
        .from("indicadores_financieros")
        .select("*")
        .in("empresa_id", empresaIds)
        .order("periodo", { ascending: false }),
      supabase.from("experiencia").select("*").in("empresa_id", empresaIds),
    ]);

  if (indError) throw new Error(indError.message);
  if (expError) throw new Error(expError.message);

  const empresasContexto: EmpresaContexto[] = participantes.map((p) => {
    const indicadorMasReciente = (indicadores ?? []).find((i) => i.empresa_id === p.empresa_id) ?? null;
    const experienciaEmpresa = (experiencia ?? []).filter((e) => e.empresa_id === p.empresa_id);
    const empresaInfo = p.empresas as unknown as {
      nombre: string;
      registra_obras_inconclusas: boolean | null;
      es_empresa_mujeres: boolean | null;
    } | null;

    return {
      nombre: empresaInfo?.nombre ?? "Empresa",
      participacionPct: p.porcentaje_participacion,
      registraObrasInconclusas: empresaInfo?.registra_obras_inconclusas ?? null,
      esEmpresaMujeres: empresaInfo?.es_empresa_mujeres ?? null,
      indicadores: indicadorMasReciente
        ? {
            periodo: indicadorMasReciente.periodo,
            patrimonio: indicadorMasReciente.patrimonio,
            capital_trabajo: indicadorMasReciente.capital_trabajo,
            indice_liquidez: indicadorMasReciente.indice_liquidez,
            indice_endeudamiento: indicadorMasReciente.indice_endeudamiento,
            razon_cobertura_intereses: indicadorMasReciente.razon_cobertura_intereses,
            rentabilidad_patrimonio: indicadorMasReciente.rentabilidad_patrimonio,
            rentabilidad_activo: indicadorMasReciente.rentabilidad_activo,
            activo_corriente: indicadorMasReciente.activo_corriente,
            pasivo_corriente: indicadorMasReciente.pasivo_corriente,
            activo_total: indicadorMasReciente.activo_total,
            pasivo_total: indicadorMasReciente.pasivo_total,
            utilidad_operacional: indicadorMasReciente.utilidad_operacional,
            gastos_financieros: indicadorMasReciente.gastos_financieros,
          }
        : null,
      experienciaExcluidaEnEjecucion: experienciaEmpresa.filter((e) => e.estado === "en_ejecucion").length,
      experiencia: experienciaEmpresa
        .filter((e) => e.estado !== "en_ejecucion")
        .map((e) => ({
          entidad_contratante: e.entidad_contratante,
          objeto: e.objeto,
          valor: e.valor,
          sector: e.sector,
          fecha_inicio: e.fecha_inicio,
          fecha_terminacion: e.fecha_terminacion,
          participacion_pct: e.participacion_pct,
        })),
    };
  });

  try {
    const resultado = await verificarCumplimiento(
      (analisis.requisitos_juridicos ?? []) as RequisitoAnalisis[],
      (analisis.requisitos_financieros ?? []) as RequisitoAnalisis[],
      (analisis.requisitos_tecnicos ?? []) as RequisitoAnalisis[],
      empresasContexto,
    );

    const { error: upsertError } = await supabase.from("verificacion_cumplimiento").upsert(
      {
        licitacion_id: licitacionId,
        estado: "completado",
        resumen: resultado.resumen,
        resultados: resultado.resultados,
        empresas_evaluadas: empresaIds,
        error_mensaje: null,
        modelo: "claude-sonnet-5",
      },
      { onConflict: "licitacion_id" },
    );

    if (upsertError) throw new Error(upsertError.message);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido al verificar cumplimiento";
    await supabase
      .from("verificacion_cumplimiento")
      .upsert(
        { licitacion_id: licitacionId, estado: "error", error_mensaje: message },
        { onConflict: "licitacion_id" },
      );
    revalidatePath(`/licitaciones/${licitacionId}`);
    throw new Error(message);
  }

  revalidatePath(`/licitaciones/${licitacionId}`);
}
