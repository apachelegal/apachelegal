"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/** Reemplaza el equipo de la licitación por el del simulador (empresas y porcentajes). */
export async function aplicarEquipoSimulado(licitacionId: string, miembros: { empresaId: string; pct: number }[]) {
  if (miembros.length === 0) throw new Error("Agrega al menos un integrante");
  const suma = miembros.reduce((a, m) => a + m.pct, 0);
  if (Math.abs(suma - 100) > 0.01) throw new Error(`Los porcentajes deben sumar 100 % (suman ${suma})`);
  if (new Set(miembros.map((m) => m.empresaId)).size !== miembros.length) throw new Error("Hay una empresa repetida");

  const supabase = createAdminClient();
  const { error: errBorrar } = await supabase.from("licitacion_participantes").delete().eq("licitacion_id", licitacionId);
  if (errBorrar) throw new Error(errBorrar.message);
  const { error } = await supabase
    .from("licitacion_participantes")
    .insert(miembros.map((m) => ({ licitacion_id: licitacionId, empresa_id: m.empresaId, porcentaje_participacion: m.pct })));
  if (error) throw new Error(error.message);

  revalidatePath(`/licitaciones/${licitacionId}`);
  revalidatePath("/control/simulador");
}
