"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { analizarDocumentos } from "@/lib/ai/analizarPliego";

const MAX_PDFS = 8;
const MAX_MANUALES = 2;

export async function analizarLicitacion(licitacionId: string) {
  const supabase = createAdminClient();

  const [{ data: licitacion, error: licError }, { data: documentos, error: docsError }] =
    await Promise.all([
      supabase.from("licitaciones").select("entidad_id").eq("id", licitacionId).single(),
      supabase
        .from("documentos")
        .select("*")
        .eq("licitacion_id", licitacionId)
        .in("tipo", ["pliego", "anexo"]),
    ]);

  if (licError) throw new Error(licError.message);
  if (docsError) throw new Error(docsError.message);

  const pdfs = (documentos ?? []).filter(
    (d) => d.content_type === "application/pdf" || d.nombre.toLowerCase().endsWith(".pdf"),
  );

  if (pdfs.length === 0) {
    throw new Error("Sube el pliego (y anexos) en formato PDF antes de analizar.");
  }
  if (pdfs.length > MAX_PDFS) {
    throw new Error(
      `Hay ${pdfs.length} documentos PDF y el máximo por análisis es ${MAX_PDFS}. Elimina anexos poco relevantes e intenta de nuevo.`,
    );
  }

  const documentosDescargados = await Promise.all(
    pdfs.map(async (doc) => {
      const { data: blob, error } = await supabase.storage
        .from("licitaciones")
        .download(doc.storage_path);
      if (error || !blob) {
        throw new Error(`No se pudo descargar "${doc.nombre}": ${error?.message ?? "error desconocido"}`);
      }
      const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      return { id: doc.id as string, nombre: doc.nombre as string, base64 };
    }),
  );

  let manualesDescargados: { nombre: string; base64: string }[] = [];
  if (licitacion?.entidad_id) {
    const { data: manuales, error: manualesError } = await supabase
      .from("manuales_contratacion")
      .select("*")
      .eq("entidad_id", licitacion.entidad_id)
      .limit(MAX_MANUALES);

    if (manualesError) throw new Error(manualesError.message);

    manualesDescargados = await Promise.all(
      (manuales ?? []).map(async (doc) => {
        const { data: blob, error } = await supabase.storage
          .from("entidades")
          .download(doc.storage_path);
        if (error || !blob) {
          throw new Error(`No se pudo descargar el manual "${doc.nombre}": ${error?.message ?? "error desconocido"}`);
        }
        const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
        return { nombre: doc.nombre as string, base64 };
      }),
    );
  }

  try {
    const resultado = await analizarDocumentos(
      documentosDescargados.map(({ nombre, base64 }) => ({ nombre, base64 })),
      manualesDescargados,
    );

    const { error: upsertError } = await supabase.from("analisis_licitacion").upsert(
      {
        licitacion_id: licitacionId,
        estado: "completado",
        resumen: resultado.resumen,
        requisitos_juridicos: resultado.requisitos_juridicos,
        requisitos_financieros: resultado.requisitos_financieros,
        requisitos_tecnicos: resultado.requisitos_tecnicos,
        anexos_detectados: resultado.anexos_detectados,
        fechas_clave: resultado.fechas_clave,
        error_mensaje: null,
        modelo: "claude-sonnet-5",
        documentos_analizados: documentosDescargados.map((d) => d.id),
      },
      { onConflict: "licitacion_id" },
    );

    if (upsertError) throw new Error(upsertError.message);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido al analizar con IA";
    await supabase
      .from("analisis_licitacion")
      .upsert(
        { licitacion_id: licitacionId, estado: "error", error_mensaje: message },
        { onConflict: "licitacion_id" },
      );
    revalidatePath(`/licitaciones/${licitacionId}`);
    throw new Error(message);
  }

  revalidatePath(`/licitaciones/${licitacionId}`);
}
