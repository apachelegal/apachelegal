import { createAdminClient } from "@/lib/supabase/admin";
import { evaluarCarpeta, hoyISO } from "@/lib/habilitacion/checklist";
import { calcularRuta, type PasoRuta } from "@/lib/licitaciones/preparacion";
import type { Empresa, EmpresaDocumento, Experiencia, Licitacion } from "@/lib/types";

export interface ResumenPreparacion {
  licitacion: Licitacion;
  porcentaje: number;
  siguiente: PasoRuta | null;
  pasos: PasoRuta[];
  participantes: { nombre: string; porcentaje: number }[];
  tareasVencidas: number;
  proximaTarea: { titulo: string; fecha: string } | null;
}

/** Habilitación documental (0-100) de cada empresa, sobre la fecha de hoy. */
export async function cargarHabilitacionEmpresas(): Promise<{ empresa: Empresa; global: number | null; alertas: number }[]> {
  const supabase = createAdminClient();
  const [{ data: empresas }, { data: docs }, { data: exps }] = await Promise.all([
    supabase.from("empresas").select("*").order("nombre"),
    supabase.from("empresa_documentos").select("*"),
    supabase.from("experiencia").select("id, empresa_id, entidad_contratante, estado, verificacion_titular"),
  ]);
  const { data: expDocs } = await supabase.from("experiencia_documentos").select("experiencia_id");
  const conCertificado = new Set((expDocs ?? []).map((d) => d.experiencia_id as string));
  return ((empresas ?? []) as Empresa[]).filter((empresa) => !empresa.archivada).map((empresa) => {
    const estado = evaluarCarpeta(
      empresa,
      ((docs ?? []) as EmpresaDocumento[]).filter((d) => d.empresa_id === empresa.id),
      ((exps ?? []) as Experiencia[]).filter((e) => e.empresa_id === empresa.id),
      conCertificado,
      hoyISO(),
    );
    return { empresa, global: estado.porcentajes.global, alertas: estado.alertas.length };
  });
}

export async function cargarResumenes(licitaciones: Licitacion[]): Promise<Map<string, ResumenPreparacion>> {
  const resultado = new Map<string, ResumenPreparacion>();
  if (licitaciones.length === 0) return resultado;
  const supabase = createAdminClient();
  const ids = licitaciones.map((l) => l.id);

  const [
    { data: documentos },
    { data: analisis },
    { data: tareas },
    { data: checklist },
    { data: participantes },
    { data: verificaciones },
    { data: selecciones },
    { data: presupuesto },
    habilitacion,
  ] = await Promise.all([
    supabase.from("documentos").select("licitacion_id, tipo, nombre, content_type").in("licitacion_id", ids),
    supabase.from("analisis_licitacion").select("licitacion_id, estado").in("licitacion_id", ids),
    supabase.from("tareas").select("licitacion_id, titulo, estado, fecha_limite").in("licitacion_id", ids),
    supabase.from("checklist_items").select("licitacion_id, completado").in("licitacion_id", ids),
    supabase.from("licitacion_participantes").select("licitacion_id, empresa_id, porcentaje_participacion").in("licitacion_id", ids),
    supabase.from("verificacion_cumplimiento").select("licitacion_id, estado").in("licitacion_id", ids),
    supabase.from("licitacion_experiencia_seleccionada").select("licitacion_id").in("licitacion_id", ids),
    supabase
      .from("presupuesto_items")
      .select("licitacion_id, total, costo_unitario, cantidad")
      .in("licitacion_id", ids)
      .limit(20000),
    cargarHabilitacionEmpresas(),
  ]);

  const habPorEmpresa = new Map(habilitacion.map((h) => [h.empresa.id, h]));
  const hoy = hoyISO();

  for (const lic of licitaciones) {
    const docs = (documentos ?? []).filter((d) => d.licitacion_id === lic.id);
    const parts = (participantes ?? []).filter((p) => p.licitacion_id === lic.id);
    const tareasLic = (tareas ?? []).filter((t) => t.licitacion_id === lic.id);
    const chk = (checklist ?? []).filter((c) => c.licitacion_id === lic.id);
    const items = (presupuesto ?? []).filter((i) => i.licitacion_id === lic.id);
    const costoDirecto = items.reduce((a, i) => a + (i.total ?? 0), 0);
    const costoCargado = items.reduce((a, i) => a + (i.costo_unitario != null ? i.costo_unitario * (i.cantidad ?? 0) : 0), 0);
    const globales = parts
      .map((p) => habPorEmpresa.get(p.empresa_id)?.global)
      .filter((v): v is number => v != null);

    const ruta = calcularRuta({
      hayPliego: docs.some((d) => d.tipo === "pliego"),
      hayPdf: docs.some((d) => d.content_type === "application/pdf" || (d.nombre as string).toLowerCase().endsWith(".pdf")),
      analisisEstado: (analisis ?? []).find((a) => a.licitacion_id === lic.id)?.estado ?? null,
      participantes: parts.length,
      sumaParticipacion: parts.reduce((a, p) => a + Number(p.porcentaje_participacion ?? 0), 0),
      habilitacionPct: parts.length ? (globales.length ? globales.reduce((a, b) => a + b, 0) / globales.length : 0) : null,
      verificacionEstado: (verificaciones ?? []).find((v) => v.licitacion_id === lic.id)?.estado ?? null,
      experienciaSeleccionada: (selecciones ?? []).filter((s) => s.licitacion_id === lic.id).length,
      itemsPresupuesto: items.length,
      coberturaCostos: costoDirecto ? costoCargado / costoDirecto : 0,
      checklistTotal: chk.length,
      checklistHechos: chk.filter((c) => c.completado).length,
      tareasTotal: tareasLic.length,
      tareasHechas: tareasLic.filter((t) => t.estado === "completada").length,
      tareasVencidas: tareasLic.filter((t) => t.estado !== "completada" && t.fecha_limite && t.fecha_limite < hoy).length,
    });

    const pendientes = tareasLic
      .filter((t) => t.estado !== "completada" && t.fecha_limite)
      .sort((a, b) => (a.fecha_limite as string).localeCompare(b.fecha_limite as string));
    const proxima = pendientes.find((t) => (t.fecha_limite as string) >= hoy) ?? null;

    resultado.set(lic.id, {
      licitacion: lic,
      porcentaje: ruta.porcentaje,
      siguiente: ruta.siguiente,
      pasos: ruta.pasos,
      participantes: parts.map((p) => ({
        nombre: habPorEmpresa.get(p.empresa_id)?.empresa.nombre ?? "Empresa",
        porcentaje: Number(p.porcentaje_participacion ?? 0),
      })),
      tareasVencidas: tareasLic.filter((t) => t.estado !== "completada" && t.fecha_limite && t.fecha_limite < hoy).length,
      proximaTarea: proxima ? { titulo: proxima.titulo as string, fecha: proxima.fecha_limite as string } : null,
    });
  }
  return resultado;
}
