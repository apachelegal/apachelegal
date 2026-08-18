"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EstadoTarea } from "@/lib/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function crearTarea(licitacionId: string, formData: FormData) {
  const supabase = createAdminClient();

  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) throw new Error("El título de la tarea es obligatorio");

  const { error } = await supabase.from("tareas").insert({
    licitacion_id: licitacionId,
    titulo,
    responsable: String(formData.get("responsable") ?? "").trim() || null,
    fecha_limite: String(formData.get("fecha_limite") ?? "") || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/licitaciones/${licitacionId}`);
}

export async function actualizarEstadoTarea(licitacionId: string, tareaId: string, estado: EstadoTarea) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("tareas").update({ estado }).eq("id", tareaId);
  if (error) throw new Error(error.message);
  revalidatePath(`/licitaciones/${licitacionId}`);
}

export async function eliminarTarea(licitacionId: string, tareaId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("tareas").delete().eq("id", tareaId);
  if (error) throw new Error(error.message);
  revalidatePath(`/licitaciones/${licitacionId}`);
}

export async function generarTareasDesdeFechasClave(licitacionId: string) {
  const supabase = createAdminClient();

  const { data: analisis, error: analisisError } = await supabase
    .from("analisis_licitacion")
    .select("fechas_clave")
    .eq("licitacion_id", licitacionId)
    .maybeSingle();

  if (analisisError) throw new Error(analisisError.message);

  const fechasClave = (analisis?.fechas_clave ?? []) as { evento: string; fecha?: string }[];
  if (fechasClave.length === 0) {
    throw new Error("No hay fechas clave detectadas por la IA todavía. Analiza el pliego primero.");
  }

  const { data: existentes, error: existentesError } = await supabase
    .from("tareas")
    .select("titulo")
    .eq("licitacion_id", licitacionId)
    .eq("origen", "ia");

  if (existentesError) throw new Error(existentesError.message);

  const titulosExistentes = new Set((existentes ?? []).map((t) => t.titulo));
  const nuevas = fechasClave
    .filter((f) => !titulosExistentes.has(f.evento))
    .map((f) => ({
      licitacion_id: licitacionId,
      titulo: f.evento,
      fecha_limite: f.fecha && ISO_DATE.test(f.fecha) ? f.fecha : null,
      origen: "ia" as const,
    }));

  if (nuevas.length === 0) {
    revalidatePath(`/licitaciones/${licitacionId}`);
    return;
  }

  const { error: insertError } = await supabase.from("tareas").insert(nuevas);
  if (insertError) throw new Error(insertError.message);

  revalidatePath(`/licitaciones/${licitacionId}`);
}
