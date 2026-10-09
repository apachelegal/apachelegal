"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { FORMATOS_EAAB } from "@/lib/eaab/formatos";

const ENTREGABLES_JURIDICOS = [
  { nombre: "Garantía de seriedad de la oferta", descripcion: "10 % del presupuesto oficial, vigencia de 3 meses desde el cierre, a favor de la EAAB-ESP (formato para empresas prestadoras de servicios públicos). En plural, el tomador es el consorcio o unión temporal con los porcentajes." },
  { nombre: "Certificado de existencia y representación legal", descripcion: "Expedido máximo 30 días antes del cierre; uno por cada persona jurídica. Objeto social compatible y duración de la sociedad mayor al plazo del contrato más un año." },
  { nombre: "Documento de constitución del consorcio o unión temporal", descripcion: "Con objeto, representante y facultades, porcentajes y duración (plazo del contrato, liquidación y un año más). No se aceptan promesas ni constitución sujeta a la adjudicación." },
  { nombre: "RUP renovado y en firme (cada integrante)", descripcion: "De aquí la EAAB toma la experiencia y los indicadores financieros." },
  { nombre: "RUT y documento de identidad del representante legal (cada integrante)", descripcion: "Copia legible." },
  { nombre: "Certificado REDAM del representante legal o del oferente", descripcion: "O declaración juramentada con el motivo si no se puede obtener." },
  { nombre: "Abono de la oferta por ingeniero civil o sanitario", descripcion: "Con firma, cédula, tarjeta profesional y certificado vigente del consejo profesional." },
  { nombre: "Asistencia a la visita obligatoria", descripcion: "No asistir es causal de rechazo. Asiste un ingeniero civil o sanitario con los requisitos del Anexo 10." },
];

export async function cargarEntregablesEaab(licitacionId: string) {
  const supabase = createAdminClient();
  const { data: existentes } = await supabase.from("checklist_items").select("nombre").eq("licitacion_id", licitacionId);
  const nombres = new Set((existentes ?? []).map((e) => e.nombre as string));

  const deFormatos = FORMATOS_EAAB.filter((f) => f.obligatorio).map((f) => ({
    nombre: f.nombre,
    descripcion: f.nota,
    obligatorio: true,
  }));
  const juridicos = ENTREGABLES_JURIDICOS.map((j) => ({ ...j, obligatorio: true }));
  const nuevos = [...juridicos, ...deFormatos]
    .filter((i) => !nombres.has(i.nombre))
    .map((i) => ({ licitacion_id: licitacionId, nombre: i.nombre, descripcion: i.descripcion, obligatorio: i.obligatorio, completado: false, origen: "manual" }));

  if (nuevos.length > 0) {
    const { error } = await supabase.from("checklist_items").insert(nuevos);
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/licitaciones/${licitacionId}`);
  return nuevos.length;
}
