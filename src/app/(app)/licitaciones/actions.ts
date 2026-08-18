"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TipoDocumento } from "@/lib/types";

export async function createLicitacion(formData: FormData) {
  const supabase = createAdminClient();

  const payload = {
    entidad: String(formData.get("entidad") ?? "").trim(),
    objeto: String(formData.get("objeto") ?? "").trim(),
    numero_proceso: String(formData.get("numero_proceso") ?? "").trim() || null,
    estado: String(formData.get("estado") ?? "en_estudio"),
    presupuesto: formData.get("presupuesto") ? Number(formData.get("presupuesto")) : null,
    fecha_apertura: String(formData.get("fecha_apertura") ?? "") || null,
    fecha_cierre: String(formData.get("fecha_cierre") ?? "") || null,
    fecha_vencimiento: String(formData.get("fecha_vencimiento") ?? "") || null,
    responsable: String(formData.get("responsable") ?? "").trim() || null,
    notas: String(formData.get("notas") ?? "").trim() || null,
  };

  if (!payload.entidad || !payload.objeto) {
    throw new Error("Entidad y objeto son obligatorios");
  }

  const { data, error } = await supabase
    .from("licitaciones")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/licitaciones");
  revalidatePath("/");
  redirect(`/licitaciones/${data.id}`);
}

export async function updateLicitacionEstado(id: string, estado: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("licitaciones").update({ estado }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/licitaciones/${id}`);
  revalidatePath("/licitaciones");
}

export async function deleteLicitacion(id: string) {
  const supabase = createAdminClient();

  const { data: docs } = await supabase
    .from("documentos")
    .select("storage_path")
    .eq("licitacion_id", id);

  if (docs && docs.length > 0) {
    await supabase.storage
      .from("licitaciones")
      .remove(docs.map((d) => d.storage_path));
  }

  const { error } = await supabase.from("licitaciones").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/licitaciones");
  revalidatePath("/");
  redirect("/licitaciones");
}

export async function uploadDocumento(licitacionId: string, formData: FormData) {
  const supabase = createAdminClient();
  const file = formData.get("file") as File | null;
  const tipo = String(formData.get("tipo") ?? "otro") as TipoDocumento;

  if (!file || file.size === 0) {
    throw new Error("Selecciona un archivo");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${licitacionId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("licitaciones")
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { error: insertError } = await supabase.from("documentos").insert({
    licitacion_id: licitacionId,
    nombre: file.name,
    tipo,
    storage_path: storagePath,
    tamano_bytes: file.size,
    content_type: file.type,
  });

  if (insertError) {
    await supabase.storage.from("licitaciones").remove([storagePath]);
    throw new Error(insertError.message);
  }

  revalidatePath(`/licitaciones/${licitacionId}`);
}

export async function deleteDocumento(licitacionId: string, documentoId: string, storagePath: string) {
  const supabase = createAdminClient();

  await supabase.storage.from("licitaciones").remove([storagePath]);

  const { error } = await supabase.from("documentos").delete().eq("id", documentoId);
  if (error) throw new Error(error.message);

  revalidatePath(`/licitaciones/${licitacionId}`);
}

export async function getDocumentoUrl(storagePath: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("licitaciones")
    .createSignedUrl(storagePath, 60 * 5);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}
