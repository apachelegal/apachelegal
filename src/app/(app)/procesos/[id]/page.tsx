import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Caso, CasoDocumento, CasoHecho, CasoPrueba, CasoTarea } from "@/lib/casos";
import { FichaSection } from "./FichaSection";
import { TareasSection } from "./TareasSection";
import { CronologiaSection } from "./CronologiaSection";
import { PruebasSection } from "./PruebasSection";
import { DocumentosSection } from "./DocumentosSection";

export default async function CasoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: caso, error }, { data: tareas }, { data: hechos }, { data: pruebas }, { data: documentos }] =
    await Promise.all([
      supabase.from("casos").select("*").eq("id", id).single(),
      supabase.from("caso_tareas").select("*").eq("caso_id", id).order("orden", { nullsFirst: false }),
      supabase
        .from("caso_hechos")
        .select("*")
        .eq("caso_id", id)
        .order("fecha", { ascending: true, nullsFirst: false })
        .order("created_at"),
      supabase.from("caso_pruebas").select("*").eq("caso_id", id).order("created_at"),
      supabase.from("caso_documentos").select("*").eq("caso_id", id).order("created_at", { ascending: false }),
    ]);

  if (error || !caso) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/procesos" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} />
        Volver a procesos
      </Link>

      <FichaSection caso={caso as Caso} />
      <TareasSection casoId={id} tareas={(tareas ?? []) as CasoTarea[]} />
      <CronologiaSection casoId={id} hechos={(hechos ?? []) as CasoHecho[]} />
      <PruebasSection casoId={id} pruebas={(pruebas ?? []) as CasoPrueba[]} />
      <DocumentosSection casoId={id} documentos={(documentos ?? []) as CasoDocumento[]} />
    </div>
  );
}
