"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TipoEmpresaDocumento } from "@/lib/types";

export async function uploadEmpresaDocumento(empresaId: string, formData: FormData) {
  const supabase = createAdminClient();
  const file = formData.get("file") as File | null;
  const tipo = String(formData.get("tipo") ?? "otro") as TipoEmpresaDocumento;

  if (!file || file.size === 0) throw new Error("Selecciona un archivo");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${empresaId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("empresas")
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { error: insertError } = await supabase.from("empresa_documentos").insert({
    empresa_id: empresaId,
    nombre: file.name,
    tipo,
    storage_path: storagePath,
    tamano_bytes: file.size,
    content_type: file.type,
  });

  if (insertError) {
    await supabase.storage.from("empresas").remove([storagePath]);
    throw new Error(insertError.message);
  }

  revalidatePath(`/empresas/${empresaId}`);
}

export async function eliminarEmpresaDocumento(empresaId: string, documentoId: string, storagePath: string) {
  const supabase = createAdminClient();
  await supabase.storage.from("empresas").remove([storagePath]);
  const { error } = await supabase.from("empresa_documentos").delete().eq("id", documentoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/empresas/${empresaId}`);
}

export async function getEmpresaDocumentoUrl(storagePath: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("empresas")
    .createSignedUrl(storagePath, 60 * 5);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function uploadExperienciaDocumento(
  empresaId: string,
  experienciaId: string,
  formData: FormData,
) {
  const supabase = createAdminClient();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Selecciona un archivo");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${empresaId}/experiencia/${experienciaId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("empresas")
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { error: insertError } = await supabase.from("experiencia_documentos").insert({
    experiencia_id: experienciaId,
    nombre: file.name,
    storage_path: storagePath,
    tamano_bytes: file.size,
    content_type: file.type,
  });

  if (insertError) {
    await supabase.storage.from("empresas").remove([storagePath]);
    throw new Error(insertError.message);
  }

  revalidatePath(`/empresas/${empresaId}`);
}

export async function eliminarExperienciaDocumento(
  empresaId: string,
  documentoId: string,
  storagePath: string,
) {
  const supabase = createAdminClient();
  await supabase.storage.from("empresas").remove([storagePath]);
  const { error } = await supabase.from("experiencia_documentos").delete().eq("id", documentoId);
  if (error) throw new Error(error.message);
  revalidatePath(`/empresas/${empresaId}`);
}
