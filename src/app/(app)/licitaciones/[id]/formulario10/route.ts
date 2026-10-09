import { NextResponse } from "next/server";
import { cargarDatosFormulario10, generarFormulario10, generarSoporteFormulario10 } from "@/lib/eaab/formulario10";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const soporte = new URL(request.url).searchParams.get("soporte") === "1";

  const datos = await cargarDatosFormulario10(id);
  if (!datos) return NextResponse.json({ error: "Licitación no encontrada" }, { status: 404 });

  try {
    const buffer = soporte ? await generarSoporteFormulario10(datos) : await generarFormulario10(datos);
    const base = (datos.numeroProceso ?? "licitacion").replace(/[^a-zA-Z0-9._-]/g, "_");
    const nombre = soporte ? `${base}_Formulario_10_SOPORTE_interno.xlsx` : `${base}_Formulario_10.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombre}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al generar el formulario" }, { status: 500 });
  }
}
