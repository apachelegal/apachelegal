import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EntidadContratante, ManualContratacion } from "@/lib/types";
import { ManualesSection } from "./ManualesSection";
import { DeleteEntidadButton } from "./DeleteEntidadButton";

export default async function EntidadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: entidad, error }, { data: manuales }] = await Promise.all([
    supabase.from("entidades_contratantes").select("*").eq("id", id).single(),
    supabase
      .from("manuales_contratacion")
      .select("*")
      .eq("entidad_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (error || !entidad) notFound();

  const ent = entidad as EntidadContratante;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link href="/entidades" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} />
        Volver a entidades
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{ent.nombre}</h1>
          {ent.notas && <p className="mt-1 text-sm text-slate-400">{ent.notas}</p>}
        </div>
        <DeleteEntidadButton id={ent.id} />
      </div>

      <ManualesSection entidadId={ent.id} manuales={(manuales ?? []) as ManualContratacion[]} />
    </div>
  );
}
