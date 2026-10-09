import { createAdminClient } from "@/lib/supabase/admin";
import { sugerirEtiquetas } from "./etiquetas";

export type TipoServicio = "interventoria" | "consultoria";

export interface DocInterventoria {
  id: string;
  nombre: string;
  storagePath: string;
}

export interface ContratoInterventoria {
  id: string;
  empresaId: string;
  empresa: string;
  grupo: boolean;
  tipo: TipoServicio;
  /** El usuario la clasificó a mano (no sale del texto del objeto). */
  manual: boolean;
  entidad: string;
  eaab: boolean;
  numero: string | null;
  objeto: string;
  smmlv: number | null;
  participacion: number | null;
  /** SMMLV × participación; 0 si el contrato lo aporta un socio (no cuenta como experiencia de la empresa). */
  aporte: number | null;
  /** Experiencia de un accionista o socio que la EAAB no acepta para la empresa. */
  deSocio: boolean;
  fecha: string | null;
  consecutivoRup: string | null;
  /** Etiquetas confirmadas a mano con el certificado a la vista. */
  etiquetas: string[];
  /** Etiquetas que salen del texto del objeto, sin confirmar. */
  sugeridas: string[];
  documentos: DocInterventoria[];
}

const RE_INTERVENTORIA = /interventor[ií]a|supervisi[oó]n t[eé]cnica/i;
const RE_CONSULTORIA = /consultor[ií]a/i;
const RE_EAAB = /acueducto y alcantarillado de bogot|^eaab\b|acueducto,? alcantarillado y aseo de bogot/i;

/**
 * Un contrato es de interventoría o de consultoría según lo que haya marcado el usuario (`detalles.tipo_servicio`) o, si no,
 * según el sector y el comienzo del objeto. Devuelve null si es una obra.
 */
export function clasificarServicio(objeto: string, sector: string | null, detalles: Record<string, unknown> | null): { tipo: TipoServicio; manual: boolean } | null {
  const marca = detalles?.tipo_servicio;
  if (marca === "interventoria" || marca === "consultoria") return { tipo: marca, manual: true };
  if (marca === "obra") return null;
  const cabeza = objeto.slice(0, 160);
  const s = String(sector ?? "");
  if (/^INTERVENTORIA/i.test(s) || RE_INTERVENTORIA.test(cabeza)) return { tipo: "interventoria", manual: false };
  if (/^CONSULTORIA/i.test(s) || RE_CONSULTORIA.test(cabeza)) return { tipo: "consultoria", manual: false };
  return null;
}

export async function cargarInterventorias(): Promise<ContratoInterventoria[]> {
  const supabase = createAdminClient();
  const [{ data: empresas }, { data: exp }, { data: docs }] = await Promise.all([
    supabase.from("empresas").select("id, nombre, categoria, archivada"),
    supabase
      .from("experiencia")
      .select("id, empresa_id, entidad_contratante, numero_contrato, objeto, sector, valor_smmlv, participacion_pct, fecha_terminacion, consecutivo_rup, detalles")
      .limit(5000),
    supabase.from("experiencia_documentos").select("id, experiencia_id, nombre, storage_path").limit(10000),
  ]);
  const porEmpresa = new Map((empresas ?? []).map((e) => [e.id as string, e]));
  const docsPorExp = new Map<string, DocInterventoria[]>();
  for (const d of docs ?? []) {
    const lista = docsPorExp.get(d.experiencia_id as string) ?? [];
    lista.push({ id: d.id as string, nombre: d.nombre as string, storagePath: d.storage_path as string });
    docsPorExp.set(d.experiencia_id as string, lista);
  }
  const salida: ContratoInterventoria[] = [];
  for (const x of exp ?? []) {
    const e = porEmpresa.get(x.empresa_id as string);
    if (!e || e.archivada) continue;
    const objeto = String(x.objeto ?? "");
    const cls = clasificarServicio(objeto, (x.sector as string | null) ?? null, (x.detalles as Record<string, unknown> | null) ?? null);
    if (!cls) continue;
    const smmlv = x.valor_smmlv != null ? Number(x.valor_smmlv) : null;
    const part = x.participacion_pct != null ? Number(x.participacion_pct) : null;
    const entidad = String(x.entidad_contratante ?? "");
    const rup = ((x.detalles as Record<string, unknown> | null)?.rup ?? null) as Record<string, unknown> | null;
    const deSocio = rup?.aportada_por_socio === true;
    salida.push({
      id: x.id as string,
      empresaId: x.empresa_id as string,
      empresa: e.nombre as string,
      grupo: e.categoria === "grupo",
      tipo: cls.tipo,
      manual: cls.manual,
      entidad,
      eaab: RE_EAAB.test(entidad.trim()),
      numero: (x.numero_contrato as string | null) ?? null,
      objeto,
      smmlv,
      participacion: part,
      aporte: deSocio ? 0 : smmlv != null ? smmlv * ((part ?? 100) / 100) : null,
      deSocio,
      fecha: (x.fecha_terminacion as string | null) ?? null,
      consecutivoRup: (x.consecutivo_rup as string | null) ?? null,
      etiquetas: Array.isArray((x.detalles as Record<string, unknown> | null)?.interventoria_etiquetas) ? ((x.detalles as Record<string, unknown>).interventoria_etiquetas as string[]) : [],
      sugeridas: sugerirEtiquetas(objeto),
      documentos: docsPorExp.get(x.id as string) ?? [],
    });
  }
  return salida.sort((a, b) => a.empresa.localeCompare(b.empresa) || (b.fecha ?? "").localeCompare(a.fecha ?? ""));
}
