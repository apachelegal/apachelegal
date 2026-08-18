"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function agregarParticipante(licitacionId: string, formData: FormData) {
  const supabase = createAdminClient();

  const empresaId = String(formData.get("empresa_id") ?? "");
  const porcentaje = Number(formData.get("porcentaje_participacion") ?? 100);

  if (!empresaId) throw new Error("Selecciona una empresa");
  if (!(porcentaje > 0 && porcentaje <= 100)) {
    throw new Error("El porcentaje de participación debe estar entre 1 y 100");
  }

  const { error } = await supabase.from("licitacion_participantes").insert({
    licitacion_id: licitacionId,
    empresa_id: empresaId,
    porcentaje_participacion: porcentaje,
  });

  if (error) {
    if (error.code === "23505") throw new Error("Esa empresa ya está agregada a esta licitación");
    throw new Error(error.message);
  }

  revalidatePath(`/licitaciones/${licitacionId}`);
}

export async function eliminarParticipante(licitacionId: string, participanteId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("licitacion_participantes")
    .delete()
    .eq("id", participanteId);
  if (error) throw new Error(error.message);
  revalidatePath(`/licitaciones/${licitacionId}`);
}
