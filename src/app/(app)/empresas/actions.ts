"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function crearEmpresa(formData: FormData) {
  const supabase = createAdminClient();

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("El nombre de la empresa es obligatorio");

  const { data, error } = await supabase
    .from("empresas")
    .insert({
      nombre,
      nit: String(formData.get("nit") ?? "").trim() || null,
      notas: String(formData.get("notas") ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/empresas");
  redirect(`/empresas/${data.id}`);
}

export async function eliminarEmpresa(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("empresas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/empresas");
  redirect("/empresas");
}

export async function guardarIndicadores(empresaId: string, formData: FormData) {
  const supabase = createAdminClient();

  const periodo = String(formData.get("periodo") ?? "").trim();
  if (!periodo) throw new Error("El período (año) es obligatorio");

  const num = (key: string) => {
    const v = formData.get(key);
    if (!v || String(v).trim() === "") return null;
    return Number(v);
  };

  const { error } = await supabase.from("indicadores_financieros").upsert(
    {
      empresa_id: empresaId,
      periodo,
      patrimonio: num("patrimonio"),
      capital_trabajo: num("capital_trabajo"),
      indice_liquidez: num("indice_liquidez"),
      indice_endeudamiento: num("indice_endeudamiento"),
      razon_cobertura_intereses: num("razon_cobertura_intereses"),
      rentabilidad_patrimonio: num("rentabilidad_patrimonio"),
      rentabilidad_activo: num("rentabilidad_activo"),
      activo_corriente: num("activo_corriente"),
      pasivo_corriente: num("pasivo_corriente"),
      activo_total: num("activo_total"),
      pasivo_total: num("pasivo_total"),
      utilidad_operacional: num("utilidad_operacional"),
      gastos_financieros: num("gastos_financieros"),
      efectivo_generado_operacion: num("efectivo_generado_operacion"),
      efectivo_y_equivalentes: num("efectivo_y_equivalentes"),
      deuda_financiera: num("deuda_financiera"),
      notas: String(formData.get("notas") ?? "").trim() || null,
    },
    { onConflict: "empresa_id,periodo" },
  );

  if (error) throw new Error(error.message);
  revalidatePath(`/empresas/${empresaId}`);
}

export async function actualizarCriteriosEmpresa(
  empresaId: string,
  criterios: { registra_obras_inconclusas: boolean | null; es_empresa_mujeres: boolean | null },
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("empresas").update(criterios).eq("id", empresaId);
  if (error) throw new Error(error.message);
  revalidatePath(`/empresas/${empresaId}`);
}

export async function eliminarIndicadores(empresaId: string, id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("indicadores_financieros").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/empresas/${empresaId}`);
}

export async function crearExperiencia(empresaId: string, formData: FormData) {
  const supabase = createAdminClient();

  const entidad_contratante = String(formData.get("entidad_contratante") ?? "").trim();
  const objeto = String(formData.get("objeto") ?? "").trim();
  if (!entidad_contratante || !objeto) {
    throw new Error("Entidad contratante y objeto son obligatorios");
  }

  const num = (key: string) => {
    const v = formData.get(key);
    if (!v || String(v).trim() === "") return null;
    return Number(v);
  };

  const { error } = await supabase.from("experiencia").insert({
    empresa_id: empresaId,
    entidad_contratante,
    numero_contrato: String(formData.get("numero_contrato") ?? "").trim() || null,
    objeto,
    sector: String(formData.get("sector") ?? "").trim() || null,
    valor: num("valor"),
    valor_smmlv: num("valor_smmlv"),
    participacion_pct: num("participacion_pct"),
    fecha_inicio: String(formData.get("fecha_inicio") ?? "") || null,
    fecha_terminacion: String(formData.get("fecha_terminacion") ?? "") || null,
    estado: String(formData.get("estado") ?? "ejecutado"),
    codigo_unspsc: String(formData.get("codigo_unspsc") ?? "").trim() || null,
    consecutivo_rup: String(formData.get("consecutivo_rup") ?? "").trim() || null,
    origen_archivo: "manual",
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/empresas/${empresaId}`);
}

export async function eliminarExperiencia(empresaId: string, id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("experiencia").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/empresas/${empresaId}`);
}
