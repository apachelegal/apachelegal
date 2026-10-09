import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FORMATOS_EAAB, rutaFormato } from "@/lib/eaab/formatos";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; formato: string }> }) {
  const { formato } = await params;
  const f = FORMATOS_EAAB.find((x) => x.id === formato);
  if (!f) return NextResponse.json({ error: "Formato no encontrado" }, { status: 404 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from("entidades").createSignedUrl(rutaFormato(f.archivo), 300, {
    download: f.archivo,
  });
  if (error || !data) return NextResponse.json({ error: error?.message ?? "No se pudo generar el enlace" }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
