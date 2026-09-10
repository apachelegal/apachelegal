import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Empleado,
  Empresa,
  EmpresaDatosJuridicos,
  EmpresaDocumento,
  Experiencia,
  ExperienciaDocumento,
  IndicadorFinanciero,
} from "@/lib/types";
import { IndicadoresSection } from "./IndicadoresSection";
import { ExperienciaSection } from "./ExperienciaSection";
import { EmpresaDocumentosSection } from "./EmpresaDocumentosSection";
import { DatosJuridicosSection } from "./DatosJuridicosSection";
import { CriteriosPuntajeSection } from "./CriteriosPuntajeSection";
import { RolEmpresaSection } from "./RolEmpresaSection";
import { PersonalSection } from "./PersonalSection";
import { DeleteEmpresaButton } from "./DeleteEmpresaButton";

export default async function EmpresaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [
    { data: empresa, error },
    { data: indicadores },
    { data: experiencia },
    { data: empresaDocumentos },
    { data: datosJuridicos },
    { data: empleados },
  ] = await Promise.all([
    supabase.from("empresas").select("*").eq("id", id).single(),
    supabase.from("indicadores_financieros").select("*").eq("empresa_id", id),
    supabase.from("experiencia").select("*").eq("empresa_id", id),
    supabase.from("empresa_documentos").select("*").eq("empresa_id", id).order("created_at", { ascending: false }),
    supabase.from("empresa_datos_juridicos").select("*").eq("empresa_id", id).maybeSingle(),
    supabase.from("empleados").select("*").eq("empresa_id", id),
  ]);

  if (error || !empresa) notFound();

  const emp = empresa as Empresa;
  const experienciaIds = (experiencia ?? []).map((e) => e.id);

  const { data: experienciaDocumentos } = experienciaIds.length
    ? await supabase.from("experiencia_documentos").select("*").in("experiencia_id", experienciaIds)
    : { data: [] as ExperienciaDocumento[] };

  const documentosPorExperiencia: Record<string, ExperienciaDocumento[]> = {};
  for (const doc of (experienciaDocumentos ?? []) as ExperienciaDocumento[]) {
    (documentosPorExperiencia[doc.experiencia_id] ??= []).push(doc);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link href="/empresas" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} />
        Volver a empresas
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{emp.nombre}</h1>
          {emp.nit && <p className="text-slate-500">NIT {emp.nit}</p>}
          {emp.notas && <p className="mt-1 text-sm text-slate-400">{emp.notas}</p>}
        </div>
        <DeleteEmpresaButton id={emp.id} />
      </div>

      <RolEmpresaSection
        empresaId={emp.id}
        participaLicitaciones={emp.participa_licitaciones}
        ejecutaObra={emp.ejecuta_obra}
      />

      <CriteriosPuntajeSection
        empresaId={emp.id}
        registraObrasInconclusas={emp.registra_obras_inconclusas}
        esEmpresaMujeres={emp.es_empresa_mujeres}
      />

      <EmpresaDocumentosSection
        empresaId={emp.id}
        documentos={(empresaDocumentos ?? []) as EmpresaDocumento[]}
      />

      <DatosJuridicosSection
        empresaId={emp.id}
        datos={datosJuridicos as EmpresaDatosJuridicos | null}
        hayDocumentos={(empresaDocumentos ?? []).some(
          (d) =>
            (d.tipo === "rup" || d.tipo === "camara_comercio") &&
            (d.content_type === "application/pdf" || d.nombre.toLowerCase().endsWith(".pdf")),
        )}
      />

      <IndicadoresSection
        empresaId={emp.id}
        indicadores={(indicadores ?? []) as IndicadorFinanciero[]}
        hayDocumentosRup={(empresaDocumentos ?? []).some(
          (d) =>
            (d.tipo === "rup" || d.tipo === "estados_financieros") &&
            (d.content_type === "application/pdf" || d.nombre.toLowerCase().endsWith(".pdf")),
        )}
      />

      <ExperienciaSection
        empresaId={emp.id}
        experiencia={(experiencia ?? []) as Experiencia[]}
        documentosPorExperiencia={documentosPorExperiencia}
      />

      <PersonalSection empresaId={emp.id} empleados={(empleados ?? []) as Empleado[]} />
    </div>
  );
}
