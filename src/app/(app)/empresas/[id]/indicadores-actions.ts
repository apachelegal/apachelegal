"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { extraerIndicadores, type IndicadoresExtraidos } from "@/lib/ai/extraerIndicadores";

const MAX_PDFS = 5;

export async function extraerIndicadoresAction(empresaId: string): Promise<IndicadoresExtraidos> {
  const supabase = createAdminClient();

  const { data: documentos, error: docsError } = await supabase
    .from("empresa_documentos")
    .select("*")
    .eq("empresa_id", empresaId)
    .in("tipo", ["rup", "estados_financieros"]);

  if (docsError) throw new Error(docsError.message);

  const pdfs = (documentos ?? []).filter(
    (d) => d.content_type === "application/pdf" || d.nombre.toLowerCase().endsWith(".pdf"),
  );

  if (pdfs.length === 0) {
    throw new Error(
      "Sube el RUP o los estados financieros en formato PDF (sección Documentos de la empresa) antes de extraer los indicadores.",
    );
  }
  if (pdfs.length > MAX_PDFS) {
    throw new Error(`Hay demasiados documentos (máx. ${MAX_PDFS}). Deja solo el RUP más reciente.`);
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

  return extraerIndicadores(documentosDescargados);
}
