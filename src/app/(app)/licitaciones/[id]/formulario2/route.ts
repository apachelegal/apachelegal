import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarFormulario2, type ParticipanteFormulario2 } from "@/lib/documentos/generarFormulario2";
import type { Experiencia, IndicadorFinanciero } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: licitacion, error: licError } = await supabase
    .from("licitaciones")
    .select("entidad, numero_proceso, objeto")
    .eq("id", id)
    .single();

  if (licError || !licitacion) {
    return NextResponse.json({ error: "Licitación no encontrada" }, { status: 404 });
  }

  const { data: participantes, error: partError } = await supabase
    .from("licitacion_participantes")
    .select("empresa_id, porcentaje_participacion, empresas(nombre, nit)")
    .eq("licitacion_id", id);

  if (partError) {
    return NextResponse.json({ error: partError.message }, { status: 500 });
  }
  if (!participantes || participantes.length === 0) {
    return NextResponse.json(
      { error: "Agrega al menos una empresa participante antes de generar el Formulario No. 2." },
      { status: 400 },
    );
  }

  const empresaIds = participantes.map((p) => p.empresa_id);

  const [{ data: indicadores, error: indError }, { data: experiencia, error: expError }, { data: seleccion, error: selError }] =
    await Promise.all([
      supabase
        .from("indicadores_financieros")
        .select("*")
        .in("empresa_id", empresaIds)
        .order("periodo", { ascending: false }),
      supabase
        .from("experiencia")
        .select("*")
        .in("empresa_id", empresaIds)
        .neq("estado", "en_ejecucion"),
      supabase.from("licitacion_experiencia_seleccionada").select("experiencia_id").eq("licitacion_id", id),
    ]);

  if (indError) return NextResponse.json({ error: indError.message }, { status: 500 });
  if (expError) return NextResponse.json({ error: expError.message }, { status: 500 });
  if (selError) return NextResponse.json({ error: selError.message }, { status: 500 });

  const idsSeleccionados = new Set((seleccion ?? []).map((s) => s.experiencia_id));
  const usarSeleccion = idsSeleccionados.size > 0;

  const participantesFormulario: ParticipanteFormulario2[] = participantes.map((p) => {
    const empresaInfo = p.empresas as unknown as { nombre: string; nit: string | null } | null;
    const indicador =
      ((indicadores ?? []) as IndicadorFinanciero[]).find((i) => i.empresa_id === p.empresa_id) ?? null;
    const experienciaEmpresa = ((experiencia ?? []) as Experiencia[]).filter(
      (e) => e.empresa_id === p.empresa_id && (!usarSeleccion || idsSeleccionados.has(e.id)),
    );

    return {
      nombre: empresaInfo?.nombre ?? "Empresa",
      nitOCedula: empresaInfo?.nit ?? null,
      porcentajeParticipacion: p.porcentaje_participacion,
      indicador,
      experiencia: experienciaEmpresa,
    };
  });

  const buffer = await generarFormulario2(
    licitacion.entidad,
    licitacion.numero_proceso,
    licitacion.objeto,
    participantesFormulario,
  );

  const nombreArchivo = `${(licitacion.numero_proceso || licitacion.entidad || "licitacion")
    .replace(/[^a-zA-Z0-9._-]/g, "_")}_Formulario_2.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
