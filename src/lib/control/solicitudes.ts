import { createAdminClient } from "@/lib/supabase/admin";

export type EstadoSolicitud = "pendiente" | "enviada" | "recibida" | "no_aplica";
export type TipoSolicitud = "documento" | "certificado" | "otro";

export interface SolicitudSocio {
  id: string;
  empresa_id: string;
  tipo: TipoSolicitud;
  clave: string | null;
  titulo: string;
  detalle: string | null;
  experiencia_id: string | null;
  estado: EstadoSolicitud;
  fecha_envio: string | null;
  fecha_respuesta: string | null;
  notas: string | null;
  created_at: string;
}

export const ESTADO_LABEL: Record<EstadoSolicitud, string> = {
  pendiente: "Por pedir",
  enviada: "Pedida, esperando",
  recibida: "Recibida",
  no_aplica: "No aplica",
};

/** Carga las solicitudes; si la tabla aún no existe (migración sin correr) lo indica en vez de fallar. */
export async function cargarSolicitudes(): Promise<{ disponible: boolean; solicitudes: SolicitudSocio[] }> {
  const supabase = createAdminClient();
  const salida: SolicitudSocio[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("solicitudes_socio")
      .select("*")
      .order("created_at")
      .range(desde, desde + 999);
    if (error) return { disponible: false, solicitudes: [] };
    salida.push(...((data ?? []) as SolicitudSocio[]));
    if (!data || data.length < 1000) break;
  }
  return { disponible: true, solicitudes: salida };
}

/** Texto listo para pegar en un correo o mensaje con lo que falta pedirle a una empresa. */
export function mensajeSolicitud(nombre: string, esNatural: boolean, items: SolicitudSocio[]): string {
  const docs = items.filter((s) => s.tipo !== "certificado");
  const certs = items.filter((s) => s.tipo === "certificado");
  const linea = (s: SolicitudSocio) => `- ${s.titulo}${s.detalle ? ` (${s.detalle})` : ""}`;
  const partes = [
    esNatural ? `Estimado(a) ${nombre}:` : `Estimados señores de ${nombre}:`,
    "",
    "Estamos evaluando su posible participación como socio de un consorcio para presentarnos a los procesos de contratación de la EAAB. Para avanzar, les agradecemos remitirnos:",
  ];
  if (docs.length) partes.push("", "Documentos de habilitación:", ...docs.map(linea));
  if (certs.length) {
    partes.push(
      "",
      "Certificados de experiencia (con acta de recibo final o de liquidación y las cantidades de obra: longitud, diámetro y material de la tubería, volúmenes de concreto, áreas de pavimento):",
      ...certs.map(linea),
    );
  }
  partes.push("", "Quedamos atentos a su respuesta y agradecemos de antemano su colaboración.");
  return partes.join("\n");
}
