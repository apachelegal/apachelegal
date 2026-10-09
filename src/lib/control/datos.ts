import { createAdminClient } from "@/lib/supabase/admin";
import { evaluarCarpeta, hoyISO } from "@/lib/habilitacion/checklist";
import { valorASmmlv } from "@/lib/scoring/smmlv";
import type { ActividadExtraida } from "@/lib/eaab/criterios";
import type { Empresa, EmpresaDocumento, Experiencia, ReglasPluralEaab, RequisitosFinancierosEstructurado, RequisitosTecnicosEstructurado } from "@/lib/types";
import { pistasDeObjeto } from "./motor";
import type { ContratoCtl, DatosControl, EmpresaCtl, EstadoRup, IndicadorCtl, ProcesoCtl, ResumenEmpresaCtl } from "./tipos";

const REGLAS_POR_DEFECTO: ReglasPluralEaab = { participacion_mayor_min_pct: 45, participacion_otros_min_pct: 25, aporte_mayor_pct_valor: 50 };

/** PostgREST devuelve como máximo 1.000 filas por consulta: se pide por páginas. */
async function todas<T>(pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const salida: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await pedir(desde, desde + 999);
    if (error) throw new Error(error.message);
    salida.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return salida;
}

const soloDigitos = (s: string) => s.replace(/\D/g, "");

export async function cargarControl(): Promise<DatosControl> {
  const supabase = createAdminClient();
  const hoy = hoyISO();

  const [empresasRaw, indicadoresRaw, experienciaRaw, certRaw, docsRaw, licRes, anaRes, partRes] = await Promise.all([
    todas<Empresa>((a, b) => supabase.from("empresas").select("*").order("nombre").range(a, b)),
    todas<Record<string, unknown>>((a, b) => supabase.from("indicadores_financieros").select("*").order("periodo", { ascending: false }).range(a, b)),
    todas<Record<string, unknown>>((a, b) =>
      supabase
        .from("experiencia")
        .select("id, empresa_id, entidad_contratante, numero_contrato, objeto, sector, valor, valor_smmlv, participacion_pct, fecha_terminacion, estado, verificacion_titular, detalles, consecutivo_rup, codigo_unspsc")
        .order("id")
        .range(a, b),
    ),
    todas<{ experiencia_id: string }>((a, b) => supabase.from("experiencia_documentos").select("experiencia_id").order("id").range(a, b)),
    todas<EmpresaDocumento>((a, b) => supabase.from("empresa_documentos").select("*").order("id").range(a, b)),
    supabase.from("licitaciones").select("id, objeto, numero_proceso, estado, presupuesto").in("estado", ["en_estudio", "en_elaboracion"]),
    supabase.from("analisis_licitacion").select("licitacion_id, requisitos_tecnicos_estructurado, requisitos_financieros_estructurado"),
    supabase.from("licitacion_participantes").select("licitacion_id, empresa_id, porcentaje_participacion"),
  ]);

  // Empresas activas (las archivadas no participan del control)
  const activas = empresasRaw.filter((e) => !e.archivada);
  const ids = new Set(activas.map((e) => e.id));
  const empresas: EmpresaCtl[] = activas.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    nit: e.nit,
    categoria: e.categoria,
    tipoPersona: e.tipo_persona ?? "juridica",
  }));

  // Último período de indicadores por empresa
  const indicadores: Record<string, IndicadorCtl | null> = Object.fromEntries(empresas.map((e) => [e.id, null]));
  for (const i of indicadoresRaw) {
    const id = i.empresa_id as string;
    if (!ids.has(id) || indicadores[id]) continue;
    indicadores[id] = {
      periodo: String(i.periodo),
      patrimonio: (i.patrimonio as number | null) ?? null,
      activoCorriente: (i.activo_corriente as number | null) ?? null,
      pasivoCorriente: (i.pasivo_corriente as number | null) ?? null,
      activoTotal: (i.activo_total as number | null) ?? null,
      pasivoTotal: (i.pasivo_total as number | null) ?? null,
      utilidadOperacional: (i.utilidad_operacional as number | null) ?? null,
      gastosFinancieros: (i.gastos_financieros as number | null) ?? null,
    };
  }

  // Contratos
  const conCert = new Set(certRaw.map((c) => c.experiencia_id));
  const contratos: ContratoCtl[] = experienciaRaw
    .filter((x) => ids.has(x.empresa_id as string))
    .map((x) => {
      const det = (x.detalles ?? {}) as Record<string, unknown>;
      const rup = (det.rup ?? {}) as Record<string, unknown>;
      const original = typeof det.valor_contrato_original === "number" ? (det.valor_contrato_original as number) : null;
      const smmlv = (x.valor_smmlv as number | null) ?? valorASmmlv(original ?? ((x.valor as number | null) ?? null), (x.fecha_terminacion as string | null) ?? null);
      const acts = Array.isArray(det.actividades) ? (det.actividades as ActividadExtraida[]) : [];
      const objeto = String(x.objeto ?? "");
      return {
        id: x.id as string,
        empresaId: x.empresa_id as string,
        entidad: String(x.entidad_contratante ?? ""),
        objeto,
        sector: (x.sector as string | null) ?? null,
        consecutivo: (x.consecutivo_rup as string | null) ?? null,
        smmlv,
        part: (x.participacion_pct as number | null) ?? null,
        fecha: (x.fecha_terminacion as string | null) ?? null,
        estado: String(x.estado ?? "ejecutado"),
        titular: String(x.verificacion_titular ?? "sin_verificar"),
        aportadaPorSocio: rup.aportada_por_socio === true,
        soloSupervision: /interventor[ií]a|consultor[ií]a/i.test(objeto.slice(0, 120)) || /^(INTERVENTORIA|CONSULTORIA)/i.test(String(x.sector ?? "")),
        participacionDudosa: typeof rup.participacion_dudosa === "string",
        iaSinRevisar: acts.length > 0 && ((det.extraccion_ia ?? {}) as Record<string, unknown>).revisado === false,
        certificado: conCert.has(x.id as string),
        actividades: acts.map((a) => ({ ...a, descripcion: String(a.descripcion ?? "").slice(0, 140) })),
        pistas: pistasDeObjeto(objeto),
        aportante: rup.aportada_por_socio === true ? (rup.aportante !== undefined ? ((rup.aportante as string | null) ?? null) : String(rup.contratista ?? "").slice(0, 70) || null) : null,
        duplicaDe: typeof rup.coincide_con_experiencia_cajigas === "string" ? (rup.coincide_con_experiencia_cajigas as string) : null,
      } satisfies ContratoCtl;
    });

  // Habilitación, vigencia del RUP y vinculaciones
  const hoyMs = new Date(hoy).getTime();
  const ccPorEmpresa = new Map<string, Set<string>>();
  for (const e of activas) {
    const ccs = new Set<string>();
    for (const m of (e.notas ?? "").matchAll(/C\.?\s?C\.?\s*(?:N[oO]\.?)?\s*([\d\.]{6,})/g)) {
      const d = soloDigitos(m[1]);
      if (d.length >= 6) ccs.add(d.replace(/^0+/, ""));
    }
    ccPorEmpresa.set(e.id, ccs);
  }
  const resumen: Record<string, ResumenEmpresaCtl> = {};
  for (const e of activas) {
    const docs = docsRaw.filter((d) => d.empresa_id === e.id);
    const exps = experienciaRaw.filter((x) => x.empresa_id === e.id) as unknown as Experiencia[];
    const estado = evaluarCarpeta(e, docs, exps, conCert, hoy);
    const rups = docs.filter((d) => d.tipo === "rup");
    const vence = rups.map((d) => d.fecha_vencimiento).filter((f): f is string => !!f).sort().pop() ?? null;
    let rupEstado: EstadoRup = "sin_rup";
    if (rups.length) {
      if (!vence) rupEstado = "sin_fecha";
      else {
        const dias = Math.floor((new Date(vence).getTime() - hoyMs) / 86_400_000);
        rupEstado = dias < 0 ? "vencido" : dias <= 60 ? "por_vencer" : "vigente";
      }
    }
    const vinculadas = activas
      .filter((o) => o.id !== e.id && [...(ccPorEmpresa.get(e.id) ?? [])].some((cc) => ccPorEmpresa.get(o.id)?.has(cc)))
      .map((o) => o.nombre);
    resumen[e.id] = { habilitacion: estado.porcentajes.global, rupVence: vence, rupEstado, vinculadas };
  }

  // Procesos con requisitos estructurados
  const analisis = new Map((anaRes.data ?? []).map((a) => [a.licitacion_id as string, a]));
  const procesos: ProcesoCtl[] = [];
  for (const l of licRes.data ?? []) {
    const a = analisis.get(l.id as string);
    const fin = a?.requisitos_financieros_estructurado as RequisitosFinancierosEstructurado | null | undefined;
    const tec = a?.requisitos_tecnicos_estructurado as RequisitosTecnicosEstructurado | null | undefined;
    if (!fin || !tec) continue;
    procesos.push({
      id: l.id as string,
      etiqueta: `${l.numero_proceso ?? "Sin número"} · ${String(l.objeto ?? "").slice(0, 60)}`,
      estado: String(l.estado),
      presupuesto: (l.presupuesto as number | null) ?? null,
      reglas: tec.reglas_plural ?? REGLAS_POR_DEFECTO,
      finReq: fin,
      actividades: tec.actividades ?? [],
      categorias: tec.categorias_elegibles ?? [],
      smmlvMin: tec.valor_minimo_acumulado_smmlv ?? null,
      maxContratos: tec.max_contratos ?? 4,
      ventanaAnios: tec.ventana_recencia_anios ?? 30,
      maxIntegrantes: tec.max_integrantes_forma_asociativa ?? null,
      equipoActual: (partRes.data ?? []).filter((p) => p.licitacion_id === l.id).map((p) => ({ empresaId: p.empresa_id as string, pct: Number(p.porcentaje_participacion) })),
    });
  }
  procesos.sort((x, y) => (y.presupuesto ?? 0) - (x.presupuesto ?? 0));

  empresas.sort((a, b) => (a.categoria === b.categoria ? a.nombre.localeCompare(b.nombre) : a.categoria === "grupo" ? -1 : 1));
  return { hoy, empresas, indicadores, contratos, procesos, resumen };
}
