"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Supuestos } from "@/lib/presupuesto/margen";

export async function guardarCostoItem(
  licitacionId: string,
  itemId: string,
  costoUnitario: number | null,
  fuente: string | null,
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("presupuesto_items")
    .update({
      costo_unitario: costoUnitario,
      costo_fuente: costoUnitario == null ? null : fuente?.trim() || null,
      costo_actualizado: costoUnitario == null ? null : new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("licitacion_id", licitacionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/licitaciones/${licitacionId}`);
}

export async function guardarSupuestos(licitacionId: string, supuestos: Supuestos) {
  const supabase = createAdminClient();
  const { data: existente } = await supabase
    .from("presupuesto_resumen")
    .select("licitacion_id")
    .eq("licitacion_id", licitacionId)
    .maybeSingle();
  const { error } = existente
    ? await supabase
        .from("presupuesto_resumen")
        .update({ supuestos, updated_at: new Date().toISOString() })
        .eq("licitacion_id", licitacionId)
    : await supabase.from("presupuesto_resumen").insert({ licitacion_id: licitacionId, supuestos });
  if (error) throw new Error(error.message);
  revalidatePath(`/licitaciones/${licitacionId}`);
}
