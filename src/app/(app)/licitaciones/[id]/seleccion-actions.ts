"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { seleccionarExperiencia, type ExperienciaCandidata } from "@/lib/ai/seleccionarExperiencia";
import type { RequisitoAnalisis } from "@/lib/types";

export async function sugerirSeleccionExperiencia(licitacionId: string): Promise<{ resumen: string }> {
  const supabase = createAdminClient();

  const [{ data: analisis, error: analisisError }, { data: participantes, error: partError }] =
    await Promise.all([
      supabase
        .from("analisis_licitacion")
        .select("requisitos_tecnicos, estado")
        .eq("licitacion_id", licitacionId)
        .maybeSingle(),
      supabase
        .from("licitacion_participantes")
        .select("empresa_id, empresas(nombre)")
        .eq("licitacion_id", licitacionId),
    ]);

  if (analisisError) throw new Error(analisisError.message);
  if (partError) throw new Error(partError.message);

  if (!analisis || analisis.estado !== "completado") {
    throw new Error("Analiza el pliego con IA antes de sugerir la selección de experiencia.");
  }
  if (!participantes || participantes.length === 0) {
    throw new Error("Agrega al menos una empresa participante antes de sugerir la selección.");
  }

  const empresaIds = participantes.map((p) => p.empresa_id);

  const { data: experiencia, error: expError } = await supabase
    .from("experiencia")
    .select("*")
    .in("empresa_id", empresaIds)
    .neq("estado", "en_ejecucion");

  if (expError) throw new Error(expError.message);

  if (!experiencia || experiencia.length === 0) {
    throw new Error("Ninguna de las empresas participantes tiene experiencia habilitante registrada (no en ejecución).");
  }

  const nombrePorEmpresa = new Map(
    participantes.map((p) => [
      p.empresa_id,
      (p.empresas as unknown as { nombre: string } | null)?.nombre ?? "Empresa",
    ]),
  );

  const candidatas: ExperienciaCandidata[] = experiencia.map((e) => ({
    id: e.id,
    empresaNombre: nombrePorEmpresa.get(e.empresa_id) ?? "Empresa",
    entidad_contratante: e.entidad_contratante,
    objeto: e.objeto,
    valor: e.valor,
    valor_smmlv: e.valor_smmlv,
    codigo_unspsc: e.codigo_unspsc,
    consecutivo_rup: e.consecutivo_rup,
    fecha_inicio: e.fecha_inicio,
    fecha_terminacion: e.fecha_terminacion,
    detalles: e.detalles,
  }));

  const resultado = await seleccionarExperiencia(
    (analisis.requisitos_tecnicos ?? []) as RequisitoAnalisis[],
    candidatas,
  );

  const { error: deleteError } = await supabase
    .from("licitacion_experiencia_seleccionada")
    .delete()
    .eq("licitacion_id", licitacionId);
  if (deleteError) throw new Error(deleteError.message);

  if (resultado.seleccionados.length > 0) {
    const { error: insertError } = await supabase.from("licitacion_experiencia_seleccionada").insert(
      resultado.seleccionados.map((s) => ({
        licitacion_id: licitacionId,
        experiencia_id: s.experiencia_id,
        justificacion: s.justificacion,
        actividad_acreditada: s.actividad_acreditada || null,
        origen: "ia",
      })),
    );
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath(`/licitaciones/${licitacionId}`);
  return { resumen: resultado.resumen };
}

export async function alternarSeleccionExperiencia(
  licitacionId: string,
  experienciaId: string,
  seleccionar: boolean,
) {
  const supabase = createAdminClient();

  if (seleccionar) {
    const { error } = await supabase
      .from("licitacion_experiencia_seleccionada")
      .upsert(
        { licitacion_id: licitacionId, experiencia_id: experienciaId, origen: "manual" },
        { onConflict: "licitacion_id,experiencia_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("licitacion_experiencia_seleccionada")
      .delete()
      .eq("licitacion_id", licitacionId)
      .eq("experiencia_id", experienciaId);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/licitaciones/${licitacionId}`);
}
