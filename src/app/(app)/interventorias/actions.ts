"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function urlDocumentoInterventoria(storagePath: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from("empresas").createSignedUrl(storagePath, 60 * 5);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Fija a mano si un contrato es de interventoría, de consultoría o una obra (la saca de este módulo). */
export async function clasificarContrato(experienciaId: string, tipo: "interventoria" | "consultoria" | "obra") {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("experiencia").select("detalles").eq("id", experienciaId).single();
  if (error) throw new Error(error.message);
  const detalles = { ...((data.detalles as Record<string, unknown> | null) ?? {}), tipo_servicio: tipo };
  const { error: e2 } = await supabase.from("experiencia").update({ detalles }).eq("id", experienciaId);
  if (e2) throw new Error(e2.message);
  revalidatePath("/interventorias");
}

/** Confirma o quita una etiqueta de obra en un contrato de interventoría (se guarda en `detalles.interventoria_etiquetas`). */
export async function alternarEtiqueta(experienciaId: string, etiqueta: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("experiencia").select("detalles").eq("id", experienciaId).single();
  if (error) throw new Error(error.message);
  const detalles = { ...((data.detalles as Record<string, unknown> | null) ?? {}) };
  const actuales = Array.isArray(detalles.interventoria_etiquetas) ? (detalles.interventoria_etiquetas as string[]) : [];
  detalles.interventoria_etiquetas = actuales.includes(etiqueta) ? actuales.filter((x) => x !== etiqueta) : [...actuales, etiqueta];
  const { error: e2 } = await supabase.from("experiencia").update({ detalles }).eq("id", experienciaId);
  if (e2) throw new Error(e2.message);
  revalidatePath("/interventorias");
  revalidatePath("/interventorias/evaluador");
}
