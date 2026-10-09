import type { SupabaseClient } from "@supabase/supabase-js";

/** El texto leído por OCR de un PDF escaneado se guarda junto al PDF, con el mismo nombre más este sufijo. */
export const SUFIJO_OCR = ".ocr.txt";
export const rutaTextoOcr = (storagePath: string) => `${storagePath}${SUFIJO_OCR}`;

const MAX_CARACTERES = 60000;

/** Descarga el texto leído de un documento, o null si ese PDF no tiene (o no se pudo bajar). */
export async function descargarTextoOcr(supabase: SupabaseClient, storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("empresas").download(rutaTextoOcr(storagePath));
  if (error || !data) return null;
  const texto = (await data.text()).trim();
  if (!texto) return null;
  return texto.length > MAX_CARACTERES ? `${texto.slice(0, MAX_CARACTERES)}\n[… texto recortado …]` : texto;
}
