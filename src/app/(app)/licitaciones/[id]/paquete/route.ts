import JSZip from "jszip";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: licitacion, error: licError } = await supabase
    .from("licitaciones")
    .select("entidad, numero_proceso")
    .eq("id", id)
    .single();

  if (licError || !licitacion) {
    return NextResponse.json({ error: "Licitación no encontrada" }, { status: 404 });
  }

  const { data: documentos, error: docsError } = await supabase
    .from("documentos")
    .select("*")
    .eq("licitacion_id", id)
    .in("tipo", ["propuesta", "anexo"]);

  if (docsError) {
    return NextResponse.json({ error: docsError.message }, { status: 500 });
  }

  if (!documentos || documentos.length === 0) {
    return NextResponse.json(
      { error: "No hay documentos de propuesta o anexos para incluir en el paquete." },
      { status: 400 },
    );
  }

  const zip = new JSZip();
  const nombresUsados = new Map<string, number>();

  for (const doc of documentos) {
    const { data: blob, error } = await supabase.storage
      .from("licitaciones")
      .download(doc.storage_path);
    if (error || !blob) continue;

    let nombre = doc.nombre;
    const veces = nombresUsados.get(nombre) ?? 0;
    if (veces > 0) {
      const dot = nombre.lastIndexOf(".");
      nombre = dot > 0 ? `${nombre.slice(0, dot)} (${veces})${nombre.slice(dot)}` : `${nombre} (${veces})`;
    }
    nombresUsados.set(doc.nombre, veces + 1);

    zip.file(nombre, await blob.arrayBuffer());
  }

  const contenido = await zip.generateAsync({ type: "arraybuffer" });
  const nombreArchivo = `${(licitacion.numero_proceso || licitacion.entidad || "licitacion")
    .replace(/[^a-zA-Z0-9._-]/g, "_")}_paquete.zip`;

  return new NextResponse(contenido, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
