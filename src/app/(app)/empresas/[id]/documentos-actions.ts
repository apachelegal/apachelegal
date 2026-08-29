"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TipoEmpresaDocumento } from "@/lib/types";
import {
  extraerDetallesExperiencia,
  type DetallesExperienciaExtraidos,
} from "@/lib/ai/extraerDetallesExperiencia";
import { verificarTitularExperiencia } from "@/lib/ai/verificarTitularExperiencia";

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

const MAX_PDFS_CERTIFICADOS = 5;

export async function extraerDetallesExperienciaAction(
  empresaId: string,
  experienciaId: string,
): Promise<DetallesExperienciaExtraidos> {
  const supabase = createAdminClient();

  const [{ data: experiencia, error: expError }, { data: documentos, error: docsError }] =
    await Promise.all([
      supabase
        .from("experiencia")
        .select("entidad_contratante, objeto")
        .eq("id", experienciaId)
        .single(),
      supabase.from("experiencia_documentos").select("*").eq("experiencia_id", experienciaId),
    ]);

  if (expError || !experiencia) throw new Error(expError?.message ?? "Contrato no encontrado");
  if (docsError) throw new Error(docsError.message);

  const pdfs = (documentos ?? []).filter(
    (d) => d.content_type === "application/pdf" || d.nombre.toLowerCase().endsWith(".pdf"),
  );

  if (pdfs.length === 0) {
    throw new Error("Sube el certificado en formato PDF antes de extraer los detalles.");
  }
  if (pdfs.length > MAX_PDFS_CERTIFICADOS) {
    throw new Error(`Hay demasiados certificados (máx. ${MAX_PDFS_CERTIFICADOS}). Elimina los menos relevantes.`);
  }

  const documentosDescargados = await Promise.all(
    pdfs.map(async (doc) => {
      const { data: blob, error } = await supabase.storage.from("empresas").download(doc.storage_path);
      if (error || !blob) {
        throw new Error(`No se pudo descargar "${doc.nombre}": ${error?.message ?? "error desconocido"}`);
      }
      const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      return { nombre: doc.nombre as string, base64 };
    }),
  );

  return extraerDetallesExperiencia(
    { entidad_contratante: experiencia.entidad_contratante, objeto: experiencia.objeto },
    documentosDescargados,
  );
}

export async function guardarDetallesExperiencia(
  empresaId: string,
  experienciaId: string,
  detalles: DetallesExperienciaExtraidos,
) {
  const supabase = createAdminClient();

  // Algunos contratos ya traen "detalles" poblado por importaciones anteriores
  // (con otras claves, ej. caudal_lps, categorias_tecnicas). Se combina en vez de
  // sobrescribir para no perder esa información.
  const { data: actual, error: fetchError } = await supabase
    .from("experiencia")
    .select("detalles")
    .eq("id", experienciaId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const detallesPrevios = (actual?.detalles as Record<string, unknown> | null) ?? {};
  const combinados = {
    ...detallesPrevios,
    actividades: detalles.actividades,
    notas: detalles.notas,
  };

  const hayContenidoNuevo = detalles.actividades.length > 0 || !!detalles.notas;
  const hayContenidoPrevio = Object.keys(detallesPrevios).length > 0;

  const { error } = await supabase
    .from("experiencia")
    .update({ detalles: hayContenidoNuevo || hayContenidoPrevio ? combinados : null })
    .eq("id", experienciaId);
  if (error) throw new Error(error.message);
  revalidatePath(`/empresas/${empresaId}`);
}

export async function verificarTitularExperienciaAction(empresaId: string, experienciaId: string) {
  const supabase = createAdminClient();

  const [{ data: experiencia, error: expError }, { data: documentos, error: docsError }, { data: empresa, error: empError }] =
    await Promise.all([
      supabase
        .from("experiencia")
        .select("entidad_contratante, objeto, numero_contrato")
        .eq("id", experienciaId)
        .single(),
      supabase.from("experiencia_documentos").select("*").eq("experiencia_id", experienciaId),
      supabase.from("empresas").select("nombre").eq("id", empresaId).single(),
    ]);

  if (expError || !experiencia) throw new Error(expError?.message ?? "Contrato no encontrado");
  if (docsError) throw new Error(docsError.message);
  if (empError || !empresa) throw new Error(empError?.message ?? "Empresa no encontrada");

  const pdfs = (documentos ?? []).filter(
    (d) => d.content_type === "application/pdf" || d.nombre.toLowerCase().endsWith(".pdf"),
  );

  if (pdfs.length === 0) {
    throw new Error("Sube el certificado en formato PDF antes de verificar el titular.");
  }

  const documentosDescargados = await Promise.all(
    pdfs.map(async (doc) => {
      const { data: blob, error } = await supabase.storage.from("empresas").download(doc.storage_path);
      if (error || !blob) {
        throw new Error(`No se pudo descargar "${doc.nombre}": ${error?.message ?? "error desconocido"}`);
      }
      const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      return { nombre: doc.nombre as string, base64, id: doc.id as string };
    }),
  );

  const resultado = await verificarTitularExperiencia(
    {
      empresaNombre: empresa.nombre,
      entidad_contratante: experiencia.entidad_contratante,
      objeto: experiencia.objeto,
      numero_contrato: experiencia.numero_contrato,
    },
    documentosDescargados,
  );

  const { error: updateError } = await supabase
    .from("experiencia")
    .update({
      verificacion_titular: resultado.rol,
      verificacion_titular_nota: resultado.nota,
      verificacion_titular_fecha: new Date().toISOString(),
      verificacion_titular_documento_id: documentosDescargados[0].id,
    })
    .eq("id", experienciaId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/empresas/${empresaId}`);

  return resultado;
}
