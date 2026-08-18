"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function vincularEntidad(licitacionId: string, entidadId: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("licitaciones")
    .update({ entidad_id: entidadId || null })
    .eq("id", licitacionId);

  if (error) throw new Error(error.message);
  revalidatePath(`/licitaciones/${licitacionId}`);
}
