"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function crearChecklistItem(licitacionId: string, formData: FormData) {
  const supabase = createAdminClient();

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("El nombre del ítem es obligatorio");

  const { error } = await supabase.from("checklist_items").insert({
    licitacion_id: licitacionId,
    nombre,
    obligatorio: formData.get("obligatorio") === "on",
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/licitaciones/${licitacionId}`);
}

export async function actualizarChecklistItem(
  licitacionId: string,
  itemId: string,
  cambios: { completado?: boolean; documento_id?: string | null },
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("checklist_items").update(cambios).eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/licitaciones/${licitacionId}`);
}

export async function eliminarChecklistItem(licitacionId: string, itemId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("checklist_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/licitaciones/${licitacionId}`);
}

export async function generarChecklistDesdeAnexos(licitacionId: string) {
  const supabase = createAdminClient();

  const { data: analisis, error: analisisError } = await supabase
    .from("analisis_licitacion")
    .select("anexos_detectados")
    .eq("licitacion_id", licitacionId)
    .maybeSingle();

  if (analisisError) throw new Error(analisisError.message);

  const anexos = (analisis?.anexos_detectados ?? []) as {
    nombre: string;
    descripcion?: string;
    obligatorio?: boolean;
  }[];

  if (anexos.length === 0) {
    throw new Error("No hay anexos detectados por la IA todavía. Analiza el pliego primero.");
  }

  const { data: existentes, error: existentesError } = await supabase
    .from("checklist_items")
    .select("nombre")
    .eq("licitacion_id", licitacionId)
    .eq("origen", "ia");

  if (existentesError) throw new Error(existentesError.message);

  const nombresExistentes = new Set((existentes ?? []).map((i) => i.nombre));
  const nuevos = anexos
    .filter((a) => !nombresExistentes.has(a.nombre))
    .map((a) => ({
      licitacion_id: licitacionId,
      nombre: a.nombre,
      descripcion: a.descripcion || null,
      obligatorio: a.obligatorio ?? true,
      origen: "ia" as const,
    }));

  if (nuevos.length === 0) {
    revalidatePath(`/licitaciones/${licitacionId}`);
    return;
  }

  const { error: insertError } = await supabase.from("checklist_items").insert(nuevos);
  if (insertError) throw new Error(insertError.message);

  revalidatePath(`/licitaciones/${licitacionId}`);
}
