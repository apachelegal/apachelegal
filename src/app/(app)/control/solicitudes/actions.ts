"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { cargarControl } from "@/lib/control/datos";
import { esUtilizable, fmtN, smmlvPonderado } from "@/lib/control/motor";
import { evaluarCarpeta, esItemBase, hoyISO } from "@/lib/habilitacion/checklist";
import type { EmpresaDocumento } from "@/lib/types";
import type { EstadoSolicitud, SolicitudSocio, TipoSolicitud } from "@/lib/control/solicitudes";

const MAX_CERTIFICADOS_POR_EMPRESA = 6;
const AVISO_TABLA = "Falta crear la tabla de solicitudes: corre la migración «solicitudes_socio» de supabase/schema.sql en el SQL Editor.";

function refrescar() {
  revalidatePath("/control/solicitudes");
  revalidatePath("/control");
}

function mensajeError(error: { message: string; code?: string }) {
  return error.code === "42P01" || /solicitudes_socio/.test(error.message) ? AVISO_TABLA : error.message;
}

interface Nueva {
  empresa_id: string;
  tipo: TipoSolicitud;
  clave: string;
  titulo: string;
  detalle: string | null;
  experiencia_id: string | null;
}

/**
 * Genera las solicitudes que se desprenden de los vacíos de cada empresa (documentos de habilitación que faltan,
 * vencidos o sin fecha, y certificados de los contratos que sí podrían servir) y actualiza las existentes:
 * si el documento o certificado ya está cargado, la solicitud pasa a «recibida».
 */
export async function generarSolicitudes(): Promise<{ creadas: number; recibidas: number }> {
  const supabase = createAdminClient();
  const hoy = hoyISO();
  const datos = await cargarControl();

  const [{ data: docs, error: errDocs }, { data: certs }, { data: existentes, error: errEx }] = await Promise.all([
    supabase.from("empresa_documentos").select("*").limit(5000),
    supabase.from("experiencia_documentos").select("experiencia_id").limit(5000),
    supabase.from("solicitudes_socio").select("*"),
  ]);
  if (errEx) throw new Error(mensajeError(errEx));
  if (errDocs) throw new Error(errDocs.message);

  const conCert = new Set((certs ?? []).map((c) => c.experiencia_id as string));
  const porClave = new Map((existentes as SolicitudSocio[]).map((s) => [`${s.empresa_id}|${s.clave}`, s]));
  const nuevas: Nueva[] = [];
  const recibidas: string[] = [];

  for (const emp of datos.empresas) {
    const docsEmp = ((docs ?? []) as EmpresaDocumento[]).filter((d) => d.empresa_id === emp.id);
    const carpeta = evaluarCarpeta({ tipo_persona: emp.tipoPersona }, docsEmp, [], conCert, hoy);

    // Documentos de habilitación
    for (const item of carpeta.items) {
      if (!esItemBase(item.def)) continue;
      const clave = `doc:${item.def.tipo}`;
      const previa = porClave.get(`${emp.id}|${clave}`);
      const pide = ["falta", "vencido", "por_vencer", "verificar"].includes(item.estado);
      if (pide && !previa) {
        const detalle =
          item.estado === "falta" ? null : item.estado === "vencido" ? "el que tenemos está vencido" : item.estado === "por_vencer" ? "el que tenemos está por vencer" : item.detalle;
        nuevas.push({ empresa_id: emp.id, tipo: "documento", clave, titulo: item.def.label, detalle, experiencia_id: null });
      } else if (!pide && previa && (previa.estado === "pendiente" || previa.estado === "enviada")) {
        recibidas.push(previa.id);
      }
    }

    // Certificados de los contratos que podrían servir: los de mayor valor ponderado primero
    const candidatos = datos.contratos
      .filter((c) => c.empresaId === emp.id && esUtilizable(c, 30, hoy))
      .sort((a, b) => smmlvPonderado(b) - smmlvPonderado(a));
    const sinCert = candidatos.filter((c) => !c.certificado).slice(0, MAX_CERTIFICADOS_POR_EMPRESA);
    for (const c of sinCert) {
      const clave = `exp:${c.id}`;
      if (porClave.has(`${emp.id}|${clave}`)) continue;
      const ref = c.consecutivo ? `Contrato ${c.consecutivo}` : "Contrato";
      nuevas.push({
        empresa_id: emp.id,
        tipo: "certificado",
        clave,
        titulo: `${ref} — ${c.entidad || "entidad sin registrar"}`,
        detalle: `${c.objeto.slice(0, 120)}${c.smmlv ? `; ${fmtN(c.smmlv)} SMMLV` : ""}`,
        experiencia_id: c.id,
      });
    }
    // Certificados que ya llegaron
    for (const c of candidatos.filter((x) => x.certificado)) {
      const previa = porClave.get(`${emp.id}|exp:${c.id}`);
      if (previa && (previa.estado === "pendiente" || previa.estado === "enviada")) recibidas.push(previa.id);
    }
  }

  if (nuevas.length) {
    const { error } = await supabase.from("solicitudes_socio").insert(nuevas);
    if (error) throw new Error(mensajeError(error));
  }
  if (recibidas.length) {
    const { error } = await supabase
      .from("solicitudes_socio")
      .update({ estado: "recibida", fecha_respuesta: hoy, updated_at: new Date().toISOString() })
      .in("id", recibidas);
    if (error) throw new Error(mensajeError(error));
  }
  refrescar();
  return { creadas: nuevas.length, recibidas: recibidas.length };
}

export async function cambiarEstadoSolicitud(ids: string[], estado: EstadoSolicitud) {
  if (!ids.length) return;
  const hoy = hoyISO();
  const cambio: Record<string, unknown> = { estado, updated_at: new Date().toISOString() };
  if (estado === "enviada") cambio.fecha_envio = hoy;
  if (estado === "recibida") cambio.fecha_respuesta = hoy;
  if (estado === "pendiente") {
    cambio.fecha_envio = null;
    cambio.fecha_respuesta = null;
  }
  const { error } = await createAdminClient().from("solicitudes_socio").update(cambio).in("id", ids);
  if (error) throw new Error(mensajeError(error));
  refrescar();
}

export async function guardarNotaSolicitud(id: string, notas: string) {
  const { error } = await createAdminClient()
    .from("solicitudes_socio")
    .update({ notas: notas.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(mensajeError(error));
  refrescar();
}

export async function crearSolicitudManual(empresaId: string, titulo: string, detalle: string) {
  if (!empresaId) throw new Error("Elige la empresa");
  if (!titulo.trim()) throw new Error("Escribe qué se le pide");
  const { error } = await createAdminClient()
    .from("solicitudes_socio")
    .insert({ empresa_id: empresaId, tipo: "otro", titulo: titulo.trim(), detalle: detalle.trim() || null });
  if (error) throw new Error(mensajeError(error));
  refrescar();
}

export async function eliminarSolicitud(id: string) {
  const { error } = await createAdminClient().from("solicitudes_socio").delete().eq("id", id);
  if (error) throw new Error(mensajeError(error));
  refrescar();
}
