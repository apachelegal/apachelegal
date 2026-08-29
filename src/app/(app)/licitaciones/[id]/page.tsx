import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCOP, formatDate } from "@/lib/format";
import type {
  AnalisisLicitacion,
  ChecklistItem,
  Documento,
  Empresa,
  EntidadContratante,
  Experiencia,
  Licitacion,
  LicitacionExperienciaSeleccionada,
  Tarea,
  VerificacionCumplimiento,
} from "@/lib/types";
import { DocumentosSection } from "./DocumentosSection";
import { EstadoSelector } from "./EstadoSelector";
import { DeleteButton } from "./DeleteButton";
import { AnalisisIASection } from "./AnalisisIASection";
import { CronogramaSection } from "./CronogramaSection";
import { PaqueteLicitacionSection } from "./PaqueteLicitacionSection";
import { ParticipantesSection } from "./ParticipantesSection";
import { BuscarEmpresasSection } from "./BuscarEmpresasSection";
import { SeleccionExperienciaSection } from "./SeleccionExperienciaSection";
import { VerificacionCumplimientoSection } from "./VerificacionCumplimientoSection";
import { EntidadVinculadaSection } from "./EntidadVinculadaSection";

export default async function LicitacionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    { data: entidades },
  ] = await Promise.all([
    supabase.from("licitaciones").select("*").eq("id", id).single(),
    supabase
      .from("documentos")
      .select("*")
      .eq("licitacion_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("analisis_licitacion").select("*").eq("licitacion_id", id).maybeSingle(),
    supabase.from("tareas").select("*").eq("licitacion_id", id),
    supabase.from("checklist_items").select("*").eq("licitacion_id", id).order("created_at"),
    supabase.from("licitacion_participantes").select("*").eq("licitacion_id", id),
    supabase.from("empresas").select("*").order("nombre"),
    supabase.from("verificacion_cumplimiento").select("*").eq("licitacion_id", id).maybeSingle(),
    supabase.from("entidades_contratantes").select("*").order("nombre"),
  ]);

  if (error || !licitacion) notFound();

  const lic = licitacion as Licitacion;

  const { count: manualesCount } = lic.entidad_id
    ? await supabase
        .from("manuales_contratacion")
        .select("*", { count: "exact", head: true })
        .eq("entidad_id", lic.entidad_id)
    : { count: 0 };

  const participanteEmpresaIds = (participantes ?? []).map((p) => p.empresa_id);
  const empresasPorId = new Map((empresas ?? []).map((e) => [e.id, e as Empresa]));

  const [{ data: experienciaParticipantes }, { data: seleccionExperiencia }] =
    participanteEmpresaIds.length > 0
      ? await Promise.all([
          supabase
            .from("experiencia")
            .select("*")
            .in("empresa_id", participanteEmpresaIds)
            .neq("estado", "en_ejecucion"),
          supabase
            .from("licitacion_experiencia_seleccionada")
            .select("*")
            .eq("licitacion_id", id),
        ])
      : [{ data: [] as Experiencia[] }, { data: [] as LicitacionExperienciaSeleccionada[] }];

  const empresasConExperiencia = participanteEmpresaIds.map((empresaId) => ({
    empresaId,
    nombre: empresasPorId.get(empresaId)?.nombre ?? "Empresa",
    experiencia: ((experienciaParticipantes ?? []) as Experiencia[]).filter(
      (e) => e.empresa_id === empresaId,
    ),
  }));

  const seleccionActual = new Map(
    ((seleccionExperiencia ?? []) as LicitacionExperienciaSeleccionada[]).map((s) => [
      s.experiencia_id,
      s,
    ]),
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link href="/licitaciones" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} />
        Volver a licitaciones
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{lic.entidad}</h1>
          <p className="text-slate-500">{lic.objeto}</p>
          {lic.numero_proceso && (
            <p className="mt-1 text-xs text-slate-400">Proceso {lic.numero_proceso}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <EstadoSelector id={lic.id} estado={lic.estado} />
          <DeleteButton id={lic.id} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InfoCard label="Presupuesto" value={formatCOP(lic.presupuesto)} />
        <InfoCard label="Apertura" value={formatDate(lic.fecha_apertura)} />
        <InfoCard label="Cierre" value={formatDate(lic.fecha_cierre)} />
        <InfoCard label="Vencimiento" value={formatDate(lic.fecha_vencimiento)} />
      </div>

      <EntidadVinculadaSection
        licitacionId={lic.id}
        entidadIdActual={lic.entidad_id}
        entidades={(entidades ?? []) as EntidadContratante[]}
        manualesCount={manualesCount ?? 0}
      />

      {(lic.responsable || lic.notas) && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {lic.responsable && (
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">Responsable:</span> {lic.responsable}
            </p>
          )}
          {lic.notas && (
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Notas:</span> {lic.notas}
            </p>
          )}
        </div>
      )}

      <ParticipantesSection
        licitacionId={lic.id}
        participantes={participantes ?? []}
        empresas={(empresas ?? []) as Empresa[]}
      />

      <BuscarEmpresasSection
        licitacionId={lic.id}
        puedeBuscar={(analisis as AnalisisLicitacion | null)?.estado === "completado"}
      />

      <SeleccionExperienciaSection
        licitacionId={lic.id}
        empresas={empresasConExperiencia}
        seleccionActual={seleccionActual}
        puedeSugerir={(analisis as AnalisisLicitacion | null)?.estado === "completado"}
        motivoBloqueo={
          (analisis as AnalisisLicitacion | null)?.estado !== "completado"
            ? "Analiza el pliego con IA antes de sugerir la selección de experiencia."
            : null
        }
      />

      <DocumentosSection licitacionId={lic.id} documentos={(documentos ?? []) as Documento[]} />

      <AnalisisIASection
        licitacionId={lic.id}
        analisis={analisis as AnalisisLicitacion | null}
        hayPdfs={(documentos ?? []).some(
          (d) => d.content_type === "application/pdf" || d.nombre.toLowerCase().endsWith(".pdf"),
        )}
      />

      <VerificacionCumplimientoSection
        licitacionId={lic.id}
        verificacion={verificacion as VerificacionCumplimiento | null}
        puedeVerificar={
          (analisis as AnalisisLicitacion | null)?.estado === "completado" &&
          (participantes ?? []).length > 0
        }
        motivoBloqueo={
          (analisis as AnalisisLicitacion | null)?.estado !== "completado"
            ? "Analiza el pliego con IA antes de poder verificar el cumplimiento."
            : (participantes ?? []).length === 0
              ? "Agrega al menos una empresa participante para poder verificar el cumplimiento."
              : null
        }
      />

      <CronogramaSection
        licitacionId={lic.id}
        tareas={(tareas ?? []) as Tarea[]}
        hayFechasClave={
          (analisis as AnalisisLicitacion | null)?.fechas_clave != null &&
          ((analisis as AnalisisLicitacion).fechas_clave?.length ?? 0) > 0
        }
      />

      <PaqueteLicitacionSection
        licitacionId={lic.id}
        items={(checklist ?? []) as ChecklistItem[]}
        documentosPaquete={(documentos ?? []).filter(
          (d) => d.tipo === "propuesta" || d.tipo === "anexo",
        ) as Documento[]}
        hayAnexosDetectados={
          (analisis as AnalisisLicitacion | null)?.anexos_detectados != null &&
          ((analisis as AnalisisLicitacion).anexos_detectados?.length ?? 0) > 0
        }
      />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
