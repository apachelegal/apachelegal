import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AnalisisLicitacion,
  ChecklistItem,
  Documento,
  Empresa,
  EmpresaDocumento,
  EntidadContratante,
  Experiencia,
  Licitacion,
  LicitacionExperienciaSeleccionada,
  Tarea,
  VerificacionCumplimiento,
} from "@/lib/types";
import { DocumentosSection } from "./DocumentosSection";
import { AnalisisIASection } from "./AnalisisIASection";
import { CronogramaSection } from "./CronogramaSection";
import { PaqueteLicitacionSection } from "./PaqueteLicitacionSection";
import { ParticipantesSection } from "./ParticipantesSection";
import { BuscarEmpresasSection } from "./BuscarEmpresasSection";
import { SeleccionExperienciaSection } from "./SeleccionExperienciaSection";
import { VerificacionCumplimientoSection } from "./VerificacionCumplimientoSection";
import { EntidadVinculadaSection } from "./EntidadVinculadaSection";
import { EncabezadoLicitacion } from "./EncabezadoLicitacion";
import { FormatosEaabSection } from "./FormatosEaabSection";
import { CalificacionSection } from "./CalificacionSection";
import { esEaab } from "@/lib/eaab/formatos";
import { RutaOferta } from "./RutaOferta";
import { TabsLicitacion } from "./TabsLicitacion";
import { ResumenLicitacion } from "./ResumenLicitacion";
import { calcularRuta, TABS_LICITACION, type TabLicitacion } from "@/lib/licitaciones/preparacion";
import { evaluarCarpeta, hoyISO } from "@/lib/habilitacion/checklist";
import { PresupuestoSection } from "./PresupuestoSection";

export default async function LicitacionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab: TabLicitacion = TABS_LICITACION.some((t) => t.id === tabParam) ? (tabParam as TabLicitacion) : "resumen";
  const supabase = createAdminClient();

  const [
    { data: licitacion, error },
    { data: documentos },
    { data: analisis },
    { data: tareas },
    { data: checklist },
    { data: participantes },
    { data: empresas },
    { data: verificacion },
    { data: seleccionIds },
    { data: itemsPresupuesto },
  ] = await Promise.all([
    supabase.from("licitaciones").select("*").eq("id", id).single(),
    supabase.from("documentos").select("*").eq("licitacion_id", id).order("created_at", { ascending: false }),
    supabase.from("analisis_licitacion").select("*").eq("licitacion_id", id).maybeSingle(),
    supabase.from("tareas").select("*").eq("licitacion_id", id),
    supabase.from("checklist_items").select("*").eq("licitacion_id", id).order("created_at"),
    supabase.from("licitacion_participantes").select("*").eq("licitacion_id", id),
    supabase.from("empresas").select("*").order("nombre"),
    supabase.from("verificacion_cumplimiento").select("*").eq("licitacion_id", id).maybeSingle(),
    supabase.from("licitacion_experiencia_seleccionada").select("id").eq("licitacion_id", id),
    supabase
      .from("presupuesto_items")
      .select("total, costo_unitario, cantidad, precio_unitario")
      .eq("licitacion_id", id)
      .limit(5000),
  ]);

  if (error || !licitacion) notFound();

  const lic = licitacion as Licitacion;
  const an = analisis as AnalisisLicitacion | null;
  const empresasPorId = new Map((empresas ?? []).map((e) => [e.id, e as Empresa]));
  const participanteEmpresaIds = (participantes ?? []).map((p) => p.empresa_id);

  // Habilitación documental promedio de los participantes.
  let habilitacionPct: number | null = null;
  if (participanteEmpresaIds.length > 0) {
    const [{ data: docsEmp }, { data: expEmp }] = await Promise.all([
      supabase.from("empresa_documentos").select("*").in("empresa_id", participanteEmpresaIds),
      supabase
        .from("experiencia")
        .select("id, empresa_id, entidad_contratante, estado, verificacion_titular")
        .in("empresa_id", participanteEmpresaIds),
    ]);
    const expIds = (expEmp ?? []).map((e) => e.id);
    const { data: expDocs } = expIds.length
      ? await supabase.from("experiencia_documentos").select("experiencia_id").in("experiencia_id", expIds)
      : { data: [] as { experiencia_id: string }[] };
    const conCertificado = new Set((expDocs ?? []).map((d) => d.experiencia_id));
    const globales = participanteEmpresaIds
      .map((eid) => {
        const emp = empresasPorId.get(eid);
        if (!emp) return null;
        return evaluarCarpeta(
          emp,
          ((docsEmp ?? []) as EmpresaDocumento[]).filter((d) => d.empresa_id === eid),
          ((expEmp ?? []) as Experiencia[]).filter((e) => e.empresa_id === eid),
          conCertificado,
          hoyISO(),
        ).porcentajes.global;
      })
      .filter((v): v is number => v != null);
    habilitacionPct = globales.length ? globales.reduce((a, b) => a + b, 0) / globales.length : 0;
  }

  const items = itemsPresupuesto ?? [];
  const costoDirecto = items.reduce((a, i) => a + (i.total ?? 0), 0);
  const costoCargado = items.reduce((a, i) => a + (i.costo_unitario != null ? (i.costo_unitario ?? 0) * (i.cantidad ?? 0) : 0), 0);
  const hoy = hoyISO();
  const tareasLista = (tareas ?? []) as Tarea[];
  const checklistLista = (checklist ?? []) as ChecklistItem[];
  const docs = (documentos ?? []) as Documento[];

  const { pasos, porcentaje, siguiente } = calcularRuta({
    hayPliego: docs.some((d) => d.tipo === "pliego"),
    hayPdf: docs.some((d) => d.content_type === "application/pdf" || d.nombre.toLowerCase().endsWith(".pdf")),
    analisisEstado: an?.estado ?? null,
    participantes: participanteEmpresaIds.length,
    sumaParticipacion: (participantes ?? []).reduce((a, p) => a + Number(p.porcentaje_participacion ?? 0), 0),
    habilitacionPct,
    verificacionEstado: (verificacion as VerificacionCumplimiento | null)?.estado ?? null,
    experienciaSeleccionada: (seleccionIds ?? []).length,
    itemsPresupuesto: items.length,
    coberturaCostos: costoDirecto ? costoCargado / costoDirecto : 0,
    checklistTotal: checklistLista.length,
    checklistHechos: checklistLista.filter((c) => c.completado).length,
    tareasTotal: tareasLista.length,
    tareasHechas: tareasLista.filter((t) => t.estado === "completada").length,
    tareasVencidas: tareasLista.filter((t) => t.estado !== "completada" && t.fecha_limite && t.fecha_limite < hoy).length,
  });

  const nombresParticipantes = (participantes ?? []).map((p) => ({
    nombre: empresasPorId.get(p.empresa_id)?.nombre ?? "Empresa",
    porcentaje: Number(p.porcentaje_participacion ?? 0),
  }));

  const conteos = {
    requisitos: docs.length,
    equipo: participanteEmpresaIds.length,
    presupuesto: items.length,
    oferta: checklistLista.length,
    cronograma: tareasLista.filter((t) => t.estado !== "completada").length,
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <EncabezadoLicitacion lic={lic} porcentaje={porcentaje} participantes={nombresParticipantes} />
      <RutaOferta licitacionId={lic.id} pasos={pasos} porcentaje={porcentaje} siguiente={siguiente} />
      <TabsLicitacion licitacionId={lic.id} activa={tab} conteos={conteos} />

      <div className="flex flex-col gap-6">{await contenidoTab()}</div>
    </div>
  );

  async function contenidoTab() {
    switch (tab) {
      case "resumen": {
        const [{ data: entidades }, manuales] = await Promise.all([
          supabase.from("entidades_contratantes").select("*").order("nombre"),
          lic.entidad_id
            ? supabase.from("manuales_contratacion").select("*", { count: "exact", head: true }).eq("entidad_id", lic.entidad_id)
            : Promise.resolve({ count: 0 }),
        ]);
        return (
          <>
            <ResumenLicitacion lic={lic} analisis={an} />
            <EntidadVinculadaSection
              licitacionId={lic.id}
              entidadIdActual={lic.entidad_id}
              entidades={(entidades ?? []) as EntidadContratante[]}
              manualesCount={manuales.count ?? 0}
            />
          </>
        );
      }
      case "requisitos":
        return (
          <>
            <DocumentosSection licitacionId={lic.id} documentos={docs} />
            <AnalisisIASection
              licitacionId={lic.id}
              analisis={an}
              hayPdfs={docs.some((d) => d.content_type === "application/pdf" || d.nombre.toLowerCase().endsWith(".pdf"))}
            />
          </>
        );
      case "equipo": {
        const [{ data: experienciaParticipantes }, { data: seleccionExperiencia }] =
          participanteEmpresaIds.length > 0
            ? await Promise.all([
                supabase.from("experiencia").select("*").in("empresa_id", participanteEmpresaIds).neq("estado", "en_ejecucion"),
                supabase.from("licitacion_experiencia_seleccionada").select("*").eq("licitacion_id", id),
              ])
            : [{ data: [] as Experiencia[] }, { data: [] as LicitacionExperienciaSeleccionada[] }];
        const empresasConExperiencia = participanteEmpresaIds.map((empresaId) => ({
          empresaId,
          nombre: empresasPorId.get(empresaId)?.nombre ?? "Empresa",
          experiencia: ((experienciaParticipantes ?? []) as Experiencia[]).filter((e) => e.empresa_id === empresaId),
        }));
        const seleccionActual = new Map(
          ((seleccionExperiencia ?? []) as LicitacionExperienciaSeleccionada[]).map((s) => [s.experiencia_id, s]),
        );
        const listo = an?.estado === "completado";
        return (
          <>
            <ParticipantesSection
              licitacionId={lic.id}
              participantes={participantes ?? []}
              empresas={(empresas ?? []) as Empresa[]}
            />
            <BuscarEmpresasSection licitacionId={lic.id} puedeBuscar={listo} />
            <SeleccionExperienciaSection
              licitacionId={lic.id}
              empresas={empresasConExperiencia}
              seleccionActual={seleccionActual}
              puedeSugerir={listo}
              motivoBloqueo={listo ? null : "Analiza el pliego con IA antes de sugerir la selección de experiencia."}
            />
            <VerificacionCumplimientoSection
              licitacionId={lic.id}
              verificacion={verificacion as VerificacionCumplimiento | null}
              puedeVerificar={listo && participanteEmpresaIds.length > 0}
              motivoBloqueo={
                !listo
                  ? "Analiza el pliego con IA antes de poder verificar el cumplimiento."
                  : participanteEmpresaIds.length === 0
                    ? "Agrega al menos una empresa participante para poder verificar el cumplimiento."
                    : null
              }
            />
          </>
        );
      }
      case "calificacion":
        return <CalificacionSection licitacionId={lic.id} />;
      case "presupuesto":
        return <PresupuestoSection licitacionId={lic.id} />;
      case "oferta":
        return (
          <>
            {esEaab(lic) && <FormatosEaabSection licitacionId={lic.id} />}
            <PaqueteLicitacionSection
            licitacionId={lic.id}
            items={checklistLista}
            documentosPaquete={docs.filter((d) => d.tipo === "propuesta" || d.tipo === "anexo")}
            hayAnexosDetectados={(an?.anexos_detectados?.length ?? 0) > 0}
            />
          </>
        );
      case "cronograma":
        return (
          <CronogramaSection
            licitacionId={lic.id}
            tareas={tareasLista}
            hayFechasClave={(an?.fechas_clave?.length ?? 0) > 0}
          />
        );
    }
  }
}
