"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function crearEntidad(formData: FormData) {
  const supabase = createAdminClient();

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) throw new Error("El nombre de la entidad es obligatorio");

  const { data, error } = await supabase
    .from("entidades_contratantes")
    .insert({
      nombre,
      notas: String(formData.get("notas") ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/entidades");
  redirect(`/entidades/${data.id}`);
}

export async function eliminarEntidad(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("entidades_contratantes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/entidades");
  redirect("/entidades");
}

export async function uploadManual(entidadId: string, formData: FormData) {
  const supabase = createAdminClient();
  const file = formData.get("file") as File | null;
  const vigencia = String(formData.get("vigencia") ?? "").trim() || null;

  if (!file || file.size === 0) throw new Error("Selecciona un archivo");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${entidadId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("entidades")
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { error: insertError } = await supabase.from("manuales_contratacion").insert({
    entidad_id: entidadId,
    nombre: file.name,
    vigencia,
    storage_path: storagePath,
    tamano_bytes: file.size,
    content_type: file.type,
  });

  if (insertError) {
    await supabase.storage.from("entidades").remove([storagePath]);
    throw new Error(insertError.message);
  }

  revalidatePath(`/entidades/${entidadId}`);
}

export async function eliminarManual(entidadId: string, manualId: string, storagePath: string) {
  const supabase = createAdminClient();
  await supabase.storage.from("entidades").remove([storagePath]);
  const { error } = await supabase.from("manuales_contratacion").delete().eq("id", manualId);
  if (error) throw new Error(error.message);
  revalidatePath(`/entidades/${entidadId}`);
}

export async function getManualUrl(storagePath: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("entidades")
    .createSignedUrl(storagePath, 60 * 5);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
