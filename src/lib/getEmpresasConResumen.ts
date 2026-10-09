import { createAdminClient } from "@/lib/supabase/admin";
import type { Empresa } from "@/lib/types";

export async function getEmpresasConResumen() {
  const supabase = createAdminClient();

  const { data: empresas, error } = await supabase.from("empresas").select("*").order("nombre");
  if (error || !empresas) return [];

  const { data: experiencia } = await supabase.from("experiencia").select("empresa_id");
  const { data: indicadores } = await supabase
    .from("indicadores_financieros")
    .select("empresa_id, periodo")
    .order("periodo", { ascending: false });

  const conteoExperiencia = new Map<string, number>();
  for (const e of experiencia ?? []) {
    conteoExperiencia.set(e.empresa_id, (conteoExperiencia.get(e.empresa_id) ?? 0) + 1);
  }

  const ultimoPeriodo = new Map<string, string>();
  for (const i of indicadores ?? []) {
    if (!ultimoPeriodo.has(i.empresa_id)) ultimoPeriodo.set(i.empresa_id, i.periodo);
  }

  return (empresas as Empresa[]).map((e) => ({
    ...e,
    experienciaCount: conteoExperiencia.get(e.id) ?? 0,
    ultimoPeriodo: ultimoPeriodo.get(e.id) ?? null,
  }));
}
