import ExcelJS from "exceljs";
import { createAdminClient } from "@/lib/supabase/admin";
import { valorASmmlv } from "@/lib/scoring/smmlv";
import type { Experiencia, IndicadorFinanciero } from "@/lib/types";
import { FORMATOS_EAAB, rutaFormato } from "./formatos";

export interface IntegranteF10 {
  empresaId: string;
  nombre: string;
  nit: string | null;
  porcentaje: number;
  indicador: IndicadorFinanciero | null;
}

export interface ContratoF10 {
  integranteIdx: number;
  empresaNombre: string;
  contratista: string;
  entidad: string;
  objeto: string;
  numeroContrato: string | null;
  valorSmmlv: number | null;
  /** Fracción entre 0 y 1. */
  participacion: number | null;
  consecutivoRup: string | null;
  unspsc: string | null;
  actividades: number[];
  fechaTerminacion: string | null;
  estado: string;
  verificacionTitular: string;
  actividadAcreditada: string | null;
  justificacion: string | null;
  certificados: string[];
  cantidades: { descripcion: string; cantidad: number; unidad: string; categoria?: string; material?: string; diametro?: number; metodo?: string }[];
  extraccionRevisada: boolean | null;
}

export interface DatosFormulario10 {
  numeroProceso: string | null;
  objeto: string;
  presupuesto: number | null;
  nombreOferente: string;
  integrantes: IntegranteF10[];
  contratos: ContratoF10[];
  requeridoSmmlv: number | null;
  advertencias: string[];
}

const num = (n: unknown): number | null => (typeof n === "number" && Number.isFinite(n) ? n : null);

function textoContratista(exp: Experiencia, empresa: string): string {
  const d = (exp.detalles ?? {}) as Record<string, unknown>;
  const consorcio = typeof d.consorcio === "string" ? d.consorcio : null;
  const integrantes = d.integrantes && typeof d.integrantes === "object" ? (d.integrantes as Record<string, string>) : null;
  if (consorcio && integrantes) {
    return `${consorcio} (${Object.entries(integrantes)
      .map(([n, p]) => `${n} ${p}`)
      .join(", ")})`;
  }
  return empresa;
}

export async function cargarDatosFormulario10(licitacionId: string): Promise<DatosFormulario10 | null> {
  const supabase = createAdminClient();
  const { data: lic } = await supabase
    .from("licitaciones")
    .select("numero_proceso, objeto, presupuesto")
    .eq("id", licitacionId)
    .single();
  if (!lic) return null;

  const advertencias: string[] = [];
  const { data: parts } = await supabase
    .from("licitacion_participantes")
    .select("empresa_id, porcentaje_participacion, empresas(nombre, nit)")
    .eq("licitacion_id", licitacionId);
  const ordenados = [...(parts ?? [])].sort((a, b) => Number(b.porcentaje_participacion) - Number(a.porcentaje_participacion));
  const empresaIds = ordenados.map((p) => p.empresa_id);

  const [{ data: indicadores }, { data: seleccion }, { data: analisis }] = await Promise.all([
    empresaIds.length
      ? supabase.from("indicadores_financieros").select("*").in("empresa_id", empresaIds).order("periodo", { ascending: false })
      : Promise.resolve({ data: [] as IndicadorFinanciero[] }),
    supabase.from("licitacion_experiencia_seleccionada").select("experiencia_id, justificacion, actividad_acreditada").eq("licitacion_id", licitacionId),
    supabase.from("analisis_licitacion").select("requisitos_tecnicos_estructurado").eq("licitacion_id", licitacionId).maybeSingle(),
  ]);

  const integrantes: IntegranteF10[] = ordenados.map((p) => {
    const info = p.empresas as unknown as { nombre: string; nit: string | null } | null;
    return {
      empresaId: p.empresa_id,
      nombre: info?.nombre ?? "Empresa",
      nit: info?.nit ?? null,
      porcentaje: Number(p.porcentaje_participacion),
      indicador: ((indicadores ?? []) as IndicadorFinanciero[]).find((i) => i.empresa_id === p.empresa_id) ?? null,
    };
  });
  if (integrantes.length === 0) advertencias.push("La licitación no tiene participantes: el formulario queda sin integrantes.");
  if (integrantes.length > 3) advertencias.push("El Formulario 10 admite hasta 3 integrantes; solo se incluyen los 3 de mayor participación.");
  for (const i of integrantes.slice(0, 3)) {
    if (!i.nit) advertencias.push(`Falta el NIT o la cédula de ${i.nombre}.`);
    if (!i.indicador) advertencias.push(`Falta la información financiera de ${i.nombre}.`);
  }

  const ids = (seleccion ?? []).map((s) => s.experiencia_id);
  const { data: exps } = ids.length
    ? await supabase.from("experiencia").select("*").in("id", ids)
    : { data: [] as Experiencia[] };
  const { data: docs } = ids.length
    ? await supabase.from("experiencia_documentos").select("experiencia_id, nombre").in("experiencia_id", ids)
    : { data: [] as { experiencia_id: string; nombre: string }[] };

  if (ids.length === 0) advertencias.push("No hay contratos elegidos: selecciona la experiencia en la pestaña Equipo.");
  if (ids.length > 4) advertencias.push("El pliego permite máximo 4 contratos: se incluyen los 4 de mayor valor.");

  const contratos: ContratoF10[] = ((exps ?? []) as Experiencia[])
    .map((e) => {
      const sel = (seleccion ?? []).find((s) => s.experiencia_id === e.id);
      const idx = integrantes.findIndex((i) => i.empresaId === e.empresa_id);
      const nombre = idx >= 0 ? integrantes[idx].nombre : "Empresa";
      const d = (e.detalles ?? {}) as Record<string, unknown>;
      const acts = Array.isArray(d.actividades) ? (d.actividades as Record<string, unknown>[]) : [];
      const ext = d.extraccion_ia as { revisado?: boolean } | undefined;
      // El pliego divide el valor certificado (no el actualizado) por el SMMLV de la fecha de terminación.
      const original = num(d.valor_contrato_original);
      const valor = e.valor_smmlv ?? valorASmmlv(original ?? e.valor, e.fecha_terminacion);
      const actividades: number[] = Array.from(new Set<number>(((sel?.actividad_acreditada ?? "").match(/[1-4]/g) ?? []).map(Number)));
      if (e.participacion_pct == null) advertencias.push(`El contrato "${(e.objeto ?? "").slice(0, 50)}…" no tiene porcentaje de participación cargado: su valor acreditado queda en 0.`);
      if (!e.consecutivo_rup) advertencias.push(`Falta el consecutivo RUP del contrato "${(e.objeto ?? "").slice(0, 50)}…".`);
      if (!e.codigo_unspsc) advertencias.push(`Falta el código UNSPSC del contrato "${(e.objeto ?? "").slice(0, 50)}…".`);
      if (actividades.length === 0) advertencias.push(`No se indicó qué actividad acredita el contrato "${(e.objeto ?? "").slice(0, 50)}…".`);
      if (e.verificacion_titular === "sin_verificar") advertencias.push(`El titular del contrato "${(e.objeto ?? "").slice(0, 50)}…" no está verificado contra el certificado.`);
      return {
        integranteIdx: idx,
        empresaNombre: nombre,
        contratista: textoContratista(e, nombre),
        entidad: e.entidad_contratante,
        objeto: e.objeto,
        numeroContrato: e.numero_contrato,
        valorSmmlv: valor,
        participacion: e.participacion_pct == null ? null : e.participacion_pct / 100,
        consecutivoRup: e.consecutivo_rup,
        unspsc: e.codigo_unspsc,
        actividades,
        fechaTerminacion: e.fecha_terminacion,
        estado: e.estado,
        verificacionTitular: e.verificacion_titular ?? "sin_verificar",
        actividadAcreditada: sel?.actividad_acreditada ?? null,
        justificacion: sel?.justificacion ?? null,
        certificados: (docs ?? []).filter((x) => x.experiencia_id === e.id).map((x) => x.nombre),
        cantidades: acts.map((a) => ({
          descripcion: String(a.descripcion ?? ""),
          cantidad: Number(a.cantidad ?? 0),
          unidad: String(a.unidad ?? ""),
          categoria: a.categoria as string | undefined,
          material: a.material as string | undefined,
          diametro: num(a.diametro_pulgadas) ?? undefined,
          metodo: a.metodo_instalacion as string | undefined,
        })),
        extraccionRevisada: ext ? Boolean(ext.revisado) : null,
      };
    })
    .sort((a, b) => (b.valorSmmlv ?? 0) - (a.valorSmmlv ?? 0))
    .slice(0, 4);

  const nombreOferente =
    integrantes.length === 1
      ? integrantes[0].nombre
      : integrantes.length > 1
        ? "COMPLETAR: nombre del consorcio o unión temporal"
        : "";

  const req = (analisis?.requisitos_tecnicos_estructurado ?? null) as { valor_minimo_acumulado_smmlv?: number | null } | null;

  return {
    numeroProceso: lic.numero_proceso,
    objeto: lic.objeto,
    presupuesto: lic.presupuesto,
    nombreOferente,
    integrantes: integrantes.slice(0, 3),
    contratos,
    requeridoSmmlv: req?.valor_minimo_acumulado_smmlv ?? null,
    advertencias: [...new Set(advertencias)],
  };
}

async function descargarPlantilla(): Promise<Buffer> {
  const formato = FORMATOS_EAAB.find((f) => f.generable === "formulario10");
  if (!formato) throw new Error("Formato 10 no está en el catálogo.");
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from("entidades").download(rutaFormato(formato.archivo));
  if (error || !data) throw new Error(`No se pudo descargar la plantilla del Formulario 10: ${error?.message ?? "sin datos"}`);
  return Buffer.from(await data.arrayBuffer());
}

/** Llena la plantilla oficial de la EAAB (Formulario 10) con los datos de la licitación, sin cambiar su diseño ni sus fórmulas. */
export async function generarFormulario10(datos: DatosFormulario10): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await descargarPlantilla()) as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  // La plantilla trae resultados guardados de sus fórmulas; se fuerza el recálculo al abrir en Excel.
  wb.calcProperties = { ...(wb.calcProperties ?? {}), fullCalcOnLoad: true };

  if (datos.numeroProceso) ws.getCell("D6").value = `INVITACIÓN PÚBLICA No. ${datos.numeroProceso}.`;
  ws.getCell("D7").value = datos.objeto.toUpperCase();
  if (datos.nombreOferente) ws.getCell("E9").value = datos.nombreOferente;

  datos.integrantes.forEach((i, k) => {
    const r = 12 + k;
    ws.getCell(`E${r}`).value = i.nombre;
    if (i.nit) ws.getCell(`G${r}`).value = i.nit;
    ws.getCell(`H${r}`).value = i.porcentaje / 100;
    const aporta = datos.contratos.some((c) => c.integranteIdx === k);
    ws.getCell(`I${r}`).value = aporta ? "SI" : "NO";

    const col = ["E", "F", "G"][k];
    const ind = i.indicador;
    if (ind) {
      ws.getCell(`${col}71`).value = Number(ind.periodo) || ind.periodo;
      const put = (fila: number, v: number | null) => {
        if (v != null) ws.getCell(`${col}${fila}`).value = v;
      };
      put(72, ind.activo_corriente);
      put(73, ind.activo_total);
      put(74, ind.pasivo_corriente);
      put(75, ind.pasivo_total);
      put(76, ind.patrimonio);
      put(77, ind.utilidad_operacional);
      put(78, ind.gastos_financieros);
    }
  });

  datos.contratos.forEach((c, k) => {
    const r = 18 + 6 * k;
    ws.getCell(`F${r}`).value = c.contratista;
    ws.getCell(`I${r}`).value = c.entidad;
    ws.getCell(`F${r + 1}`).value = c.objeto;
    if (c.numeroContrato) ws.getCell(`F${r + 2}`).value = c.numeroContrato;
    if (c.valorSmmlv != null) ws.getCell(`J${r + 2}`).value = Math.round(c.valorSmmlv * 100) / 100;
    if (c.participacion != null) ws.getCell(`L${r + 2}`).value = c.participacion;
    if (c.consecutivoRup) ws.getCell(`E${r + 4}`).value = c.consecutivoRup;
    if (c.unspsc) ws.getCell(`F${r + 4}`).value = c.unspsc;
    ["G", "H", "I", "J"].forEach((col, a) => {
      if (c.actividades.includes(a + 1)) {
        ws.getCell(`${col}${r + 4}`).value = { formula: `IF($L${r + 2}=0,0,$L${r + 2}*($J${r + 2}))` };
      }
    });
    ws.getCell(`K${r + 4}`).value = { formula: `IF(SUM(G${r + 4}:J${r + 4})>0,$L${r + 2}*$J${r + 2},0)` };
  });

  // Se descartan los resultados guardados de las fórmulas de la plantilla para que ningún visor muestre valores viejos.
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      const v = cell.value as { formula?: string; sharedFormula?: string } | null;
      if (v && typeof v === "object" && "formula" in v && v.formula) cell.value = { formula: v.formula };
    });
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Libro de apoyo interno: qué se llenó, con qué soporte y qué falta. No se entrega a la EAAB. */
export async function generarSoporteFormulario10(datos: DatosFormulario10): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const cab = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  const resumen = wb.addWorksheet("Resumen");
  resumen.columns = [{ header: "Concepto", width: 44 }, { header: "Valor", width: 70 }];
  cab(resumen);
  const acreditado = datos.contratos.reduce((a, c) => a + (c.valorSmmlv ?? 0) * (c.participacion ?? 0), 0);
  resumen.addRows([
    ["Proceso", datos.numeroProceso ?? ""],
    ["Objeto", datos.objeto],
    ["Experiencia acreditada por los contratos elegidos (SMMLV, ponderada por participación)", Math.round(acreditado * 100) / 100],
    ["Experiencia requerida (SMMLV)", datos.requeridoSmmlv ?? "No definida en el análisis de la licitación"],
    ["¿Alcanza?", datos.requeridoSmmlv == null ? "Sin dato" : acreditado >= datos.requeridoSmmlv ? "Sí" : "No"],
    ["Contratos elegidos", datos.contratos.length],
    ["Advertencias pendientes", datos.advertencias.length],
    ["Nota sobre el llenado", "Las columnas de actividad del Formulario 10 se diligencian con la fórmula de la plantilla (participación x valor del contrato) para las actividades que acredita cada contrato. Confirmar con el formato de una oferta anterior si la EAAB espera otra convención."],
  ]);

  const contratos = wb.addWorksheet("Contratos elegidos");
  contratos.columns = [
    { header: "Empresa", width: 28 }, { header: "Entidad", width: 30 }, { header: "N° contrato", width: 20 },
    { header: "Objeto", width: 60 }, { header: "Terminación", width: 13 }, { header: "Estado", width: 12 },
    { header: "Valor (SMMLV)", width: 14 }, { header: "Participación", width: 13 }, { header: "SMMLV acreditado", width: 16 },
    { header: "Actividad(es) acreditada(s)", width: 24 }, { header: "Titular verificado", width: 18 },
    { header: "Certificados cargados", width: 60 }, { header: "Justificación", width: 60 },
  ];
  cab(contratos);
  for (const c of datos.contratos) {
    contratos.addRow([
      c.empresaNombre, c.entidad, c.numeroContrato ?? "", c.objeto, c.fechaTerminacion ?? "", c.estado,
      c.valorSmmlv != null ? Math.round(c.valorSmmlv * 100) / 100 : "", c.participacion != null ? c.participacion : "",
      c.valorSmmlv != null && c.participacion != null ? Math.round(c.valorSmmlv * c.participacion * 100) / 100 : "",
      c.actividadAcreditada ?? (c.actividades.length ? c.actividades.join(", ") : ""), c.verificacionTitular,
      c.certificados.join("; "), c.justificacion ?? "",
    ]);
  }
  contratos.getColumn(8).numFmt = "0.0%";

  const cantidades = wb.addWorksheet("Cantidades certificadas");
  cantidades.columns = [
    { header: "Contrato", width: 50 }, { header: "Categoría", width: 22 }, { header: "Descripción", width: 70 },
    { header: "Cantidad", width: 14 }, { header: "Unidad", width: 10 }, { header: "Diámetro (pulg.)", width: 14 },
    { header: "Material", width: 20 }, { header: "Método", width: 16 }, { header: "Revisión", width: 26 },
  ];
  cab(cantidades);
  for (const c of datos.contratos) {
    for (const a of c.cantidades) {
      cantidades.addRow([
        c.objeto.slice(0, 80), a.categoria ?? "", a.descripcion, a.cantidad, a.unidad, a.diametro ?? "", a.material ?? "", a.metodo ?? "",
        c.extraccionRevisada === false ? "Extraído por IA, sin revisar" : c.extraccionRevisada ? "Revisado" : "Sin extracción",
      ]);
    }
  }

  const pendientes = wb.addWorksheet("Pendientes");
  pendientes.columns = [{ header: "Antes de presentar el Formulario 10", width: 120 }];
  cab(pendientes);
  if (datos.advertencias.length === 0) pendientes.addRow(["Sin pendientes detectados."]);
  for (const a of datos.advertencias) pendientes.addRow([a]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
