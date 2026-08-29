"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { extraerDatosJuridicos } from "@/lib/ai/extraerDatosJuridicos";

const MAX_PDFS = 5;

export async function extraerDatosJuridicosAction(empresaId: string) {
  const supabase = createAdminClient();

  const [{ data: documentos, error: docsError }, { data: experiencia, error: expError }] =
    await Promise.all([
      supabase
        .from("empresa_documentos")
        .select("*")
        .eq("empresa_id", empresaId)
        .in("tipo", ["rup", "camara_comercio"]),
      supabase
        .from("experiencia")
        .select("entidad_contratante, objeto, fecha_terminacion")
        .eq("empresa_id", empresaId),
    ]);

  if (docsError) throw new Error(docsError.message);
  if (expError) throw new Error(expError.message);

  const pdfs = (documentos ?? []).filter(
    (d) => d.content_type === "application/pdf" || d.nombre.toLowerCase().endsWith(".pdf"),
  );

  if (pdfs.length === 0) {
    throw new Error(
      "Sube el RUP y/o el Certificado de Cámara de Comercio en PDF (sección Documentos de la empresa) antes de extraer estos datos.",
    );
  }
  if (pdfs.length > MAX_PDFS) {
    throw new Error(`Hay demasiados documentos (máx. ${MAX_PDFS}).`);
  }

  const documentosDescargados = await Promise.all(
    pdfs.map(async (doc) => {
      const { data: blob, error } = await supabase.storage
        .from("empresas")
        .download(doc.storage_path);
      if (error || !blob) {
        throw new Error(`No se pudo descargar "${doc.nombre}": ${error?.message ?? "error desconocido"}`);
      }
      const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      return { nombre: doc.nombre as string, base64 };
    }),
  );

  const resultado = await extraerDatosJuridicos(documentosDescargados, experiencia ?? []);

  const capitalSocial =
    typeof resultado.capital_social === "number" && Number.isFinite(resultado.capital_social)
      ? resultado.capital_social
      : null;

  const { error: upsertError } = await supabase.from("empresa_datos_juridicos").upsert(
    {
      empresa_id: empresaId,
      representante_legal: resultado.representante_legal ?? null,
      tipo_documento_representante: resultado.tipo_documento_representante ?? null,
      numero_documento_representante: resultado.numero_documento_representante ?? null,
      objeto_social: resultado.objeto_social ?? null,
      fecha_constitucion: resultado.fecha_constitucion ?? null,
      duracion_sociedad: resultado.duracion_sociedad ?? null,
      capital_social: capitalSocial,
      matricula_mercantil: resultado.matricula_mercantil ?? null,
      fecha_ultima_renovacion: resultado.fecha_ultima_renovacion ?? null,
      clasificacion_rup: resultado.clasificacion_rup,
      experiencia_rup_faltante: resultado.experiencia_rup_faltante,
      modelo: "claude-sonnet-5",
    },
    { onConflict: "empresa_id" },
  );

  if (upsertError) throw new Error(upsertError.message);

  revalidatePath(`/empresas/${empresaId}`);
}

export async function agregarExperienciaDesdeRup(
  empresaId: string,
  item: {
    entidad_contratante: string;
    objeto: string;
    valor?: number;
    numero_contrato?: string;
    fecha_inicio?: string;
    fecha_terminacion?: string;
  },
) {
  const supabase = createAdminClient();

  const { error: insertError } = await supabase.from("experiencia").insert({
    empresa_id: empresaId,
    entidad_contratante: item.entidad_contratante,
    objeto: item.objeto,
    valor: item.valor ?? null,
    numero_contrato: item.numero_contrato ?? null,
    fecha_inicio: item.fecha_inicio ?? null,
    fecha_terminacion: item.fecha_terminacion ?? null,
    origen_archivo: "rup",
  });

  if (insertError) throw new Error(insertError.message);

  const { data: actual, error: fetchError } = await supabase
    .from("empresa_datos_juridicos")
    .select("experiencia_rup_faltante")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  const restantes = ((actual?.experiencia_rup_faltante ?? []) as typeof item[]).filter(
    (f) => !(f.entidad_contratante === item.entidad_contratante && f.objeto === item.objeto),
  );

  const { error: updateError } = await supabase
    .from("empresa_datos_juridicos")
    .update({ experiencia_rup_faltante: restantes })
    .eq("empresa_id", empresaId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/empresas/${empresaId}`);
}
