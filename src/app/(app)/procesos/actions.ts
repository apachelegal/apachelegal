"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ESTADO_CASO_LABELS,
  ESTADO_CASO_TAREA_LABELS,
  ESTADO_PRUEBA_LABELS,
  ETAPA_CASO_LABELS,
  TIPO_CASO_DOCUMENTO_LABELS,
  type EstadoCasoTarea,
  type EstadoPrueba,
} from "@/lib/casos";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const BUCKET = "casos";

function text(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v || null;
}

function date(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return ISO_DATE.test(v) ? v : null;
}

function oneOf<T extends string>(value: unknown, labels: Record<T, string>, fallback: NoInfer<T>): T {
  return typeof value === "string" && value in labels ? (value as T) : fallback;
}

function casoPayload(formData: FormData) {
  const valorRaw = String(formData.get("valor") ?? "").replace(/[^\d.]/g, "");
  return {
    titulo: text(formData, "titulo") ?? "",
    cliente: text(formData, "cliente"),
    contraparte: text(formData, "contraparte"),
    contrato: text(formData, "contrato"),
    objeto: text(formData, "objeto"),
    valor: valorRaw ? Number(valorRaw) : null,
    entidad: text(formData, "entidad"),
    etapa: oneOf(formData.get("etapa"), ETAPA_CASO_LABELS, "analisis"),
    estado: oneOf(formData.get("estado"), ESTADO_CASO_LABELS, "activo"),
    responsable: text(formData, "responsable"),
    resumen: text(formData, "resumen"),
    posicion: text(formData, "posicion"),
    fecha_inicio: date(formData, "fecha_inicio"),
  };
}

function revalidarCaso(casoId: string) {
  revalidatePath(`/procesos/${casoId}`);
  revalidatePath("/procesos");
}

// ---------- Casos ----------

export async function crearCaso(formData: FormData) {
  const payload = casoPayload(formData);
  if (!payload.titulo) throw new Error("El título del caso es obligatorio");

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("casos").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

  revalidatePath("/procesos");
  redirect(`/procesos/${data.id}`);
}

export async function actualizarCaso(casoId: string, formData: FormData) {
  const payload = casoPayload(formData);
  if (!payload.titulo) throw new Error("El título del caso es obligatorio");

  const supabase = createAdminClient();
  const { error } = await supabase.from("casos").update(payload).eq("id", casoId);
  if (error) throw new Error(error.message);
  revalidarCaso(casoId);
}

export async function actualizarEtapaCaso(casoId: string, etapa: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("casos")
    .update({ etapa: oneOf(etapa, ETAPA_CASO_LABELS, "analisis") })
    .eq("id", casoId);
  if (error) throw new Error(error.message);
  revalidarCaso(casoId);
}

export async function eliminarCaso(casoId: string) {
  const supabase = createAdminClient();

  const { data: docs } = await supabase
    .from("caso_documentos")
    .select("storage_path")
    .eq("caso_id", casoId);
  if (docs && docs.length > 0) {
    await supabase.storage.from(BUCKET).remove(docs.map((d) => d.storage_path));
  }

  const { error } = await supabase.from("casos").delete().eq("id", casoId);
  if (error) throw new Error(error.message);

  revalidatePath("/procesos");
  redirect("/procesos");
}

// ---------- Tareas (plan de acciones) ----------

export async function crearCasoTarea(casoId: string, formData: FormData) {
  const accion = text(formData, "accion");
  if (!accion) throw new Error("Describe la acción");

  const supabase = createAdminClient();
  const { count } = await supabase
    .from("caso_tareas")
    .select("*", { count: "exact", head: true })
    .eq("caso_id", casoId);

  const { error } = await supabase.from("caso_tareas").insert({
    caso_id: casoId,
    orden: (count ?? 0) + 1,
    ante_quien: text(formData, "ante_quien"),
    accion,
    proposito: text(formData, "proposito"),
    fecha_limite: date(formData, "fecha_limite"),
    responsable: text(formData, "responsable"),
  });
  if (error) throw new Error(error.message);
  revalidarCaso(casoId);
}

export async function actualizarCasoTarea(
  casoId: string,
  tareaId: string,
  cambios: {
    estado?: string;
    responsable?: string | null;
    fecha_limite?: string | null;
    fecha_cumplimiento?: string | null;
    soporte?: string | null;
  },
) {
  const update: Record<string, string | null> = {};

  if (cambios.estado !== undefined) {
    const estado: EstadoCasoTarea = oneOf(cambios.estado, ESTADO_CASO_TAREA_LABELS, "pendiente");
    update.estado = estado;
    // Al marcarla cumplida sin fecha, se registra hoy; al reabrirla se limpia.
    if (estado === "completada" && cambios.fecha_cumplimiento === undefined) {
      update.fecha_cumplimiento = new Date().toISOString().slice(0, 10);
    }
    if (estado === "pendiente" || estado === "en_progreso") update.fecha_cumplimiento = null;
  }
  if (cambios.responsable !== undefined) update.responsable = cambios.responsable?.trim() || null;
  if (cambios.soporte !== undefined) update.soporte = cambios.soporte?.trim() || null;
  for (const key of ["fecha_limite", "fecha_cumplimiento"] as const) {
    const v = cambios[key];
    if (v !== undefined) update[key] = v && ISO_DATE.test(v) ? v : null;
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("caso_tareas").update(update).eq("id", tareaId).eq("caso_id", casoId);
  if (error) throw new Error(error.message);
  revalidarCaso(casoId);
}

export async function eliminarCasoTarea(casoId: string, tareaId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("caso_tareas").delete().eq("id", tareaId).eq("caso_id", casoId);
  if (error) throw new Error(error.message);
  revalidarCaso(casoId);
}

// ---------- Cronología ----------

export async function crearCasoHecho(casoId: string, formData: FormData) {
  const hecho = text(formData, "hecho");
  if (!hecho) throw new Error("Describe el hecho");

  const supabase = createAdminClient();
  const { error } = await supabase.from("caso_hechos").insert({
    caso_id: casoId,
    fecha: date(formData, "fecha"),
    fecha_texto: text(formData, "fecha_texto"),
    hecho,
    relevancia: text(formData, "relevancia"),
  });
  if (error) throw new Error(error.message);
  revalidarCaso(casoId);
}

export async function eliminarCasoHecho(casoId: string, hechoId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("caso_hechos").delete().eq("id", hechoId).eq("caso_id", casoId);
  if (error) throw new Error(error.message);
  revalidarCaso(casoId);
}

// ---------- Matriz probatoria ----------

export async function crearCasoPrueba(casoId: string, formData: FormData) {
  const hecho = text(formData, "hecho");
  if (!hecho) throw new Error("Indica el hecho a probar");

  const supabase = createAdminClient();
  const { error } = await supabase.from("caso_pruebas").insert({
    caso_id: casoId,
    hecho,
    prueba: text(formData, "prueba"),
    fuente: text(formData, "fuente"),
    estado: oneOf(formData.get("estado"), ESTADO_PRUEBA_LABELS, "por_obtener"),
  });
  if (error) throw new Error(error.message);
  revalidarCaso(casoId);
}

export async function actualizarEstadoPrueba(casoId: string, pruebaId: string, estado: string) {
  const valor: EstadoPrueba = oneOf(estado, ESTADO_PRUEBA_LABELS, "por_obtener");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("caso_pruebas")
    .update({ estado: valor })
    .eq("id", pruebaId)
    .eq("caso_id", casoId);
  if (error) throw new Error(error.message);
  revalidarCaso(casoId);
}

export async function eliminarCasoPrueba(casoId: string, pruebaId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("caso_pruebas").delete().eq("id", pruebaId).eq("caso_id", casoId);
  if (error) throw new Error(error.message);
  revalidarCaso(casoId);
}

// ---------- Documentos ----------

export async function subirCasoDocumento(casoId: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Selecciona un archivo");
  const tipo = oneOf(formData.get("tipo"), TIPO_CASO_DOCUMENTO_LABELS, "otro");

  const supabase = createAdminClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${casoId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from("caso_documentos").insert({
    caso_id: casoId,
    nombre: file.name,
    tipo,
    storage_path: storagePath,
    tamano_bytes: file.size,
    content_type: file.type,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(error.message);
  }
  revalidarCaso(casoId);
}

export async function eliminarCasoDocumento(casoId: string, documentoId: string) {
  const supabase = createAdminClient();
  const { data: doc, error: findError } = await supabase
    .from("caso_documentos")
    .select("storage_path")
    .eq("id", documentoId)
    .eq("caso_id", casoId)
    .single();
  if (findError || !doc) throw new Error("Documento no encontrado");

  await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  const { error } = await supabase.from("caso_documentos").delete().eq("id", documentoId);
  if (error) throw new Error(error.message);
  revalidarCaso(casoId);
}

export async function urlCasoDocumento(casoId: string, documentoId: string) {
  const supabase = createAdminClient();
  const { data: doc, error: findError } = await supabase
    .from("caso_documentos")
    .select("storage_path")
    .eq("id", documentoId)
    .eq("caso_id", casoId)
    .single();
  if (findError || !doc) throw new Error("Documento no encontrado");

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60 * 5);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
