import { createAdminClient } from "@/lib/supabase/admin";
import { evaluarCarpeta, hoyISO, type ItemEvaluado } from "@/lib/habilitacion/checklist";
import { valorASmmlv } from "@/lib/scoring/smmlv";
import { cantidadAcreditada, textoCriterio, umbrales, type ActividadExtraida } from "@/lib/eaab/criterios";
import type {
  ActividadRequerida,
  ChecklistItem,
  Empresa,
  EmpresaDocumento,
  Experiencia,
  IndicadorFinanciero,
  PonderablesProceso,
  ReglasPluralEaab,
  RequisitosFinancierosEstructurado,
  RequisitosTecnicosEstructurado,
} from "@/lib/types";

/**
 * Simulación del informe de evaluación de la EAAB: concepto jurídico, técnico y financiero (cumple / no cumple),
 * ponderables y causales de rechazo, calculados con los datos cargados en la app. No reemplaza la evaluación
 * oficial: donde falta información, el resultado es "sin datos" y no se asume.
 */
export type Veredicto = "cumple" | "no_cumple" | "sin_datos";

export interface Verificacion {
  etiqueta: string;
  veredicto: Veredicto;
  detalle: string;
}

export interface FilaJuridica {
  etiqueta: string;
  ayuda?: string;
  /** Una casilla por integrante; en las filas de la oferta completa hay una sola. */
  celdas: { veredicto: Veredicto | "no_aplica"; detalle?: string }[];
  porIntegrante: boolean;
}

export interface ContratoEvaluado {
  integrante: string;
  entidad: string;
  objeto: string;
  numeroContrato: string | null;
  valorSmmlv: number | null;
  participacion: number | null;
  acreditadoSmmlv: number;
  unspsc: string | null;
  estado: string;
  fechaTerminacion: string | null;
  problemas: string[];
}

export interface ResultadoActividad {
  numero: number;
  descripcion: string;
  veredicto: Veredicto;
  /** Cantidad acreditada por la mejor alternativa, con su unidad y el mínimo exigido. */
  detalle: string;
  alternativas: { texto: string; acreditado: number; minimo: number; unidad: string; cumple: boolean }[];
}

export interface FinancieroIntegrante {
  nombre: string;
  porcentaje: number;
  periodo: string | null;
  liquidez: number | null;
  endeudamiento: number | null;
  cobertura: number | null;
  capitalTrabajo: number | null;
  patrimonio: number | null;
  patrimonioMinimo: number | null;
  patrimonioCumple: Veredicto;
  roe: number | null;
  roa: number | null;
}

export interface IndicadorAgrupado {
  etiqueta: string;
  valor: number | null;
  exigido: string;
  veredicto: Veredicto;
}

export interface Ponderable {
  etiqueta: string;
  maximo: number;
  puntos: number | null;
  detalle: string;
}

export interface Calificacion {
  integrantes: { nombre: string; porcentaje: number }[];
  juridico: { veredicto: Veredicto; filas: FilaJuridica[]; reglasPlural: Verificacion[] };
  tecnico: {
    veredicto: Veredicto;
    contratos: ContratoEvaluado[];
    actividades: ResultadoActividad[];
    acreditadoSmmlv: number;
    requeridoSmmlv: number | null;
    verificaciones: Verificacion[];
  };
  financiero: {
    veredicto: Veredicto;
    integrantes: FinancieroIntegrante[];
    agrupados: IndicadorAgrupado[];
    cupoCredito: Verificacion;
  };
  ponderables: { items: Ponderable[]; puntosParciales: number; maximo: number };
  causales: Verificacion[];
  conceptoFinal: Veredicto;
}

const PATRON_EAAB = /eaab|acueducto y alcantarillado de bogot|acueducto de bogot/i;
export interface EntradaCalificacion {
  presupuesto: number | null;
  requisitosTecnicos: RequisitosTecnicosEstructurado | null;
  requisitosFinancieros: RequisitosFinancierosEstructurado | null;
  hayProcesosJuridicos: boolean;
  requiereCupo: boolean;
  integrantes: {
    empresa: Empresa;
    porcentaje: number;
    documentos: EmpresaDocumento[];
    experiencia: Experiencia[];
    indicador: IndicadorFinanciero | null;
  }[];
  seleccion: { experienciaId: string; actividad: string | null }[];
  certificados: Set<string>;
  checklist: ChecklistItem[];
}

const num = (n: unknown): number | null => (typeof n === "number" && Number.isFinite(n) ? n : null);

const v = (cond: boolean | null): Veredicto => (cond == null ? "sin_datos" : cond ? "cumple" : "no_cumple");
const peor = (lista: Veredicto[]): Veredicto =>
  lista.includes("no_cumple") ? "no_cumple" : lista.includes("sin_datos") ? "sin_datos" : "cumple";

export function calcularCalificacion(e: EntradaCalificacion): Calificacion {
  const hoy = hoyISO();
  const n = e.integrantes.length;
  const plural = n > 1;
  const req = e.requisitosTecnicos;
  const reglas: ReglasPluralEaab = req?.reglas_plural ?? {
    participacion_mayor_min_pct: 45,
    participacion_otros_min_pct: 25,
    aporte_mayor_pct_valor: 50,
  };
  const pesos: PonderablesProceso = req?.ponderables ?? { economica: 897.5, mujeres: 2.5, obras_inconclusas: 100 };

  // ---------- Jurídico ----------
  const carpetas = e.integrantes.map((i) => {
    const estado = evaluarCarpeta(i.empresa, i.documentos, i.experiencia, e.certificados, hoy);
    return estado.items;
  });
  const celdaDe = (it: ItemEvaluado | undefined): FilaJuridica["celdas"][number] => {
    if (!it) return { veredicto: "no_aplica" };
    switch (it.estado) {
      case "ok":
      case "por_proceso_cargado":
        return { veredicto: "cumple", detalle: it.detalle };
      case "falta":
      case "vencido":
        return { veredicto: "no_cumple", detalle: it.detalle };
      default:
        return { veredicto: "sin_datos", detalle: it.detalle };
    }
  };
  const filaCarpeta = (tipo: string, etiqueta: string, ayuda?: string): FilaJuridica => ({
    etiqueta,
    ayuda,
    porIntegrante: true,
    celdas: carpetas.map((items) => celdaDe(items.find((it) => it.def.tipo === tipo))),
  });
  const enChecklist = (prefijo: RegExp): Verificacion["veredicto"] => {
    const it = e.checklist.find((c) => prefijo.test(c.nombre));
    return it ? (it.completado ? "cumple" : "sin_datos") : "sin_datos";
  };
  const filaOferta = (prefijo: RegExp, etiqueta: string, ayuda?: string): FilaJuridica => {
    const it = e.checklist.find((c) => prefijo.test(c.nombre));
    return {
      etiqueta,
      ayuda,
      porIntegrante: false,
      celdas: [{ veredicto: enChecklist(prefijo), detalle: it ? (it.completado ? "Entregable completo" : "Pendiente en el paquete") : "No está en el paquete" }],
    };
  };

  const filas: FilaJuridica[] = [
    filaOferta(/Formulario 1\./, "Carta de presentación de la oferta (Formulario 1)", "Firmada por el representante legal y abonada por ingeniero civil o sanitario."),
    filaOferta(/Formulario 3\./, "Compromiso anticorrupción y fraude (Formulario 3)"),
    filaOferta(/Formulario 4\./, "Compromiso frente al Código de Integridad (Formulario 4)"),
    ...(plural ? [filaOferta(/constituci[oó]n del consorcio/i, "Documento de constitución del consorcio o unión temporal")] : []),
    filaOferta(/Garant[ií]a de seriedad/i, "Garantía de seriedad de la oferta", "10 % del presupuesto, 3 meses desde el cierre."),
    filaCarpeta("camara_comercio", "Certificado de existencia y representación legal", "Máximo 30 días antes del cierre."),
    filaCarpeta("rup", "RUP renovado y en firme"),
    filaCarpeta("parafiscales", "Certificado de parafiscales (Formulario 5)"),
    filaCarpeta("rut", "RUT"),
    filaCarpeta("cedula_representante", "Documento de identidad del representante legal"),
    filaCarpeta("redam", "Certificado REDAM"),
    filaCarpeta("beneficiario_real", "Beneficiario real (Formulario 6)"),
    filaOferta(/visita obligatoria/i, "Asistencia a la visita obligatoria", "No asistir es causal de rechazo."),
  ];

  const porcentajes = e.integrantes.map((i) => i.porcentaje);
  const sumaOk = Math.abs(porcentajes.reduce((a, b) => a + b, 0) - 100) < 0.01;
  const orden = [...porcentajes].sort((a, b) => b - a);
  const reglasPlural: Verificacion[] = plural
    ? [
        { etiqueta: "Los porcentajes suman 100 %", veredicto: v(sumaOk), detalle: `Suman ${porcentajes.reduce((a, b) => a + b, 0)} %` },
        {
          etiqueta: `Un integrante con participación ≥ ${reglas.participacion_mayor_min_pct} %`,
          veredicto: v(orden[0] >= reglas.participacion_mayor_min_pct),
          detalle: `Mayor participación: ${orden[0]} %`,
        },
        {
          etiqueta: `Los demás con participación ≥ ${reglas.participacion_otros_min_pct} %`,
          veredicto: v(orden.slice(1).every((p) => p >= reglas.participacion_otros_min_pct)),
          detalle: `Menor participación: ${orden[orden.length - 1]} %`,
        },
      ]
    : [];

  const veredictoJuridico = peor([
    ...filas.flatMap((f) => f.celdas.filter((c) => c.veredicto !== "no_aplica").map((c) => c.veredicto as Veredicto)),
    ...reglasPlural.map((r) => r.veredicto),
  ]);

  // ---------- Técnico ----------
  const selIds = new Set(e.seleccion.map((s) => s.experienciaId));
  const seleccionadas = e.integrantes.flatMap((i, idx) =>
    i.experiencia.filter((x) => selIds.has(x.id)).map((x) => ({ exp: x, idx, nombre: i.empresa.nombre })),
  );
  const esSupervision = (x: Experiencia) => /interventor[ií]a|consultor[ií]a/i.test((x.objeto ?? "").slice(0, 120)) || /^(INTERVENTORIA|CONSULTORIA)/i.test(x.sector ?? "");
  const esDeSocio = (x: Experiencia) => (((x.detalles ?? {}) as Record<string, unknown>).rup as Record<string, unknown> | undefined)?.aportada_por_socio === true;
  const contratos: ContratoEvaluado[] = seleccionadas.map(({ exp, nombre }) => {
    const d = (exp.detalles ?? {}) as Record<string, unknown>;
    const original = num(d.valor_contrato_original);
    const valor = exp.valor_smmlv ?? valorASmmlv(original ?? exp.valor, exp.fecha_terminacion);
    const part = exp.participacion_pct == null ? null : exp.participacion_pct / 100;
    const problemas: string[] = [];
    if (exp.estado === "en_ejecucion") problemas.push("Está en ejecución: no cuenta como experiencia.");
    if (exp.verificacion_titular === "no_coincide") problemas.push("El certificado no nombra a esta empresa.");
    if (exp.verificacion_titular === "sin_verificar") problemas.push("Titular sin verificar contra el certificado.");
    if (esSupervision(exp)) problemas.push("Es interventoría o consultoría: no cuenta como experiencia de obra.");
    if (esDeSocio(exp)) problemas.push("El RUP lo reporta como aportado por un accionista o socio: la EAAB no lo acepta como experiencia propia.");
    if (part == null) problemas.push("Falta el porcentaje de participación.");
    if (!e.certificados.has(exp.id)) problemas.push("No tiene certificado cargado.");
    if (!exp.consecutivo_rup) problemas.push("Falta el consecutivo RUP.");
    if (!exp.codigo_unspsc) problemas.push("Falta el código UNSPSC.");
    const inicioVentana = new Date();
    inicioVentana.setFullYear(inicioVentana.getFullYear() - (req?.ventana_recencia_anios ?? 30));
    if (exp.fecha_terminacion && new Date(exp.fecha_terminacion) < inicioVentana) problemas.push("Terminó fuera de la ventana de recencia.");
    const valido = exp.estado !== "en_ejecucion" && exp.verificacion_titular !== "no_coincide" && !esSupervision(exp) && !esDeSocio(exp);
    return {
      integrante: nombre,
      entidad: exp.entidad_contratante,
      objeto: exp.objeto,
      numeroContrato: exp.numero_contrato,
      valorSmmlv: valor,
      participacion: part,
      acreditadoSmmlv: valido && valor != null && part != null ? valor * part : 0,
      unspsc: exp.codigo_unspsc,
      estado: exp.estado,
      fechaTerminacion: exp.fecha_terminacion,
      problemas,
    };
  });
  const idxContrato = seleccionadas.map((s) => s.idx);

  const validas = seleccionadas.filter((s) => s.exp.estado !== "en_ejecucion" && s.exp.verificacion_titular !== "no_coincide" && !esSupervision(s.exp) && !esDeSocio(s.exp));
  const cantidadesPorContrato = validas.map((s) => {
    const d = (s.exp.detalles ?? {}) as Record<string, unknown>;
    return { acts: Array.isArray(d.actividades) ? (d.actividades as ActividadExtraida[]) : [], sector: `${s.exp.sector ?? ""} ${s.exp.objeto ?? ""}`, part: s.exp.participacion_pct ?? null };
  });
  const cantidades = cantidadesPorContrato.flatMap((x) => x.acts);

  const actividades: ResultadoActividad[] = (req?.actividades ?? []).map((a: ActividadRequerida) => {
    const alternativas = a.alternativas.map((c) => {
      const acreditado = cantidadesPorContrato.reduce((s, x) => s + cantidadAcreditada(x.acts, c, x.sector, x.part), 0);
      return {
        texto: textoCriterio(c),
        acreditado,
        minimo: c.minimo,
        unidad: c.unidad,
        cumple: c.estricto ? acreditado > c.minimo : acreditado >= c.minimo,
      };
    });
    const mejor = alternativas.find((x) => x.cumple) ?? [...alternativas].sort((x, y) => y.acreditado / y.minimo - x.acreditado / x.minimo)[0];
    const cumple = alternativas.some((x) => x.cumple);
    const hayDatos = seleccionadas.length > 0 && cantidades.length > 0;
    return {
      numero: a.numero,
      descripcion: a.descripcion,
      veredicto: cumple ? "cumple" : hayDatos ? "no_cumple" : "sin_datos",
      detalle: mejor ? `${mejor.acreditado.toLocaleString("es-CO", { maximumFractionDigits: 1 })} ${mejor.unidad} acreditados de ${mejor.minimo.toLocaleString("es-CO")} exigidos` : "Sin datos",
      alternativas,
    } as ResultadoActividad;
  });

  const acreditadoSmmlv = contratos.reduce((s, c) => s + c.acreditadoSmmlv, 0);
  const requeridoSmmlv = req?.valor_minimo_acumulado_smmlv ?? null;
  const maxContratos = req?.max_contratos ?? 4;

  const verificacionesTec: Verificacion[] = [
    {
      etiqueta: `Máximo ${maxContratos} contratos`,
      veredicto: v(contratos.length === 0 ? null : contratos.length <= maxContratos),
      detalle: `${contratos.length} contratos elegidos`,
    },
    {
      etiqueta: "Valor acumulado en SMMLV",
      veredicto:
        requeridoSmmlv == null || contratos.length === 0 || contratos.some((c) => c.participacion == null || c.valorSmmlv == null)
          ? acreditadoSmmlv >= (requeridoSmmlv ?? Infinity) ? "cumple" : "sin_datos"
          : v(acreditadoSmmlv >= requeridoSmmlv),
      detalle: `${acreditadoSmmlv.toLocaleString("es-CO", { maximumFractionDigits: 0 })} acreditados de ${requeridoSmmlv?.toLocaleString("es-CO") ?? "?"} exigidos (valor ponderado por participación)`,
    },
    {
      etiqueta: "Solo contratos terminados y de titular verificado",
      veredicto: contratos.length === 0 ? "sin_datos" : contratos.every((c) => c.estado !== "en_ejecucion" && !c.problemas.includes("El certificado no nombra a esta empresa.")) ? "cumple" : "no_cumple",
      detalle: "No cuentan contratos en ejecución ni experiencia de socios o accionistas.",
    },
  ];
  if (plural) {
    const aportan = e.integrantes.map((_, idx) => idxContrato.some((x) => x === idx));
    verificacionesTec.push({
      etiqueta: "Todos los integrantes aportan experiencia habilitante",
      veredicto: contratos.length === 0 ? "sin_datos" : v(aportan.every(Boolean)),
      detalle: e.integrantes.map((i, idx) => `${i.empresa.nombre}: ${aportan[idx] ? "sí" : "no"}`).join(" · "),
    });
    const idxMayor = porcentajes.indexOf(Math.max(...porcentajes));
    const aporteMayor = contratos.reduce((s, c, k) => s + (idxContrato[k] === idxMayor ? c.acreditadoSmmlv : 0), 0);
    verificacionesTec.push({
      etiqueta: `El integrante de mayor participación aporta ≥ ${reglas.aporte_mayor_pct_valor} % del valor exigido`,
      veredicto: requeridoSmmlv == null || contratos.length === 0 ? "sin_datos" : v(aporteMayor >= (reglas.aporte_mayor_pct_valor / 100) * requeridoSmmlv),
      detalle: `${e.integrantes[idxMayor]?.empresa.nombre ?? ""} aporta ${aporteMayor.toLocaleString("es-CO", { maximumFractionDigits: 0 })} SMMLV`,
    });
  }

  const veredictoTecnico = peor([...actividades.map((a) => a.veredicto), ...verificacionesTec.map((x) => x.veredicto)]);

  // ---------- Financiero ----------
  const u = umbrales(e.requisitosFinancieros);
  const po = e.presupuesto ?? 0;
  const finInt: FinancieroIntegrante[] = e.integrantes.map((i) => {
    const ind = i.indicador;
    const pct = i.porcentaje / 100;
    const minPat = u.patrimonio != null ? u.patrimonio * pct : null;
    const div = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null || b === 0 ? null : a / b);
    return {
      nombre: i.empresa.nombre,
      porcentaje: i.porcentaje,
      periodo: ind?.periodo ?? null,
      liquidez: div(ind?.activo_corriente, ind?.pasivo_corriente),
      endeudamiento: div(ind?.pasivo_total, ind?.activo_total),
      cobertura: ind && (ind.gastos_financieros ?? 0) === 0 ? null : div(ind?.utilidad_operacional, ind?.gastos_financieros),
      capitalTrabajo: ind?.activo_corriente != null && ind?.pasivo_corriente != null ? ind.activo_corriente - ind.pasivo_corriente : null,
      patrimonio: ind?.patrimonio ?? null,
      patrimonioMinimo: minPat,
      patrimonioCumple: ind?.patrimonio == null || minPat == null ? "sin_datos" : v(ind.patrimonio >= minPat),
      roe: div(ind?.utilidad_operacional, ind?.patrimonio),
      roa: div(ind?.utilidad_operacional, ind?.activo_total),
    };
  });
  const completos = e.integrantes.every((i) => i.indicador && i.indicador.activo_corriente != null && i.indicador.pasivo_corriente != null && i.indicador.activo_total != null && i.indicador.pasivo_total != null && i.indicador.patrimonio != null && i.indicador.utilidad_operacional != null);
  const pond = (campo: (i: IndicadorFinanciero) => number | null | undefined) =>
    e.integrantes.reduce((s, i) => s + (i.indicador ? (campo(i.indicador) ?? 0) * (i.porcentaje / 100) : 0), 0);
  const AC = pond((i) => i.activo_corriente), PC = pond((i) => i.pasivo_corriente), AT = pond((i) => i.activo_total);
  const PT = pond((i) => i.pasivo_total), UO = pond((i) => i.utilidad_operacional), GI = pond((i) => i.gastos_financieros), PA = pond((i) => i.patrimonio);
  const CT = e.requisitosFinancieros?.capital_trabajo_suma ? e.integrantes.reduce((t, i) => t + (i.indicador ? (i.indicador.activo_corriente ?? 0) - (i.indicador.pasivo_corriente ?? 0) : 0), 0) : AC - PC;
  const fmt = (x: number | null, d = 2) => (x == null ? "—" : x.toLocaleString("es-CO", { maximumFractionDigits: d }));
  const agrupados: IndicadorAgrupado[] = [
    { etiqueta: "Índice de liquidez", valor: completos && PC ? AC / PC : null, exigido: u.liquidez != null ? `≥ ${fmt(u.liquidez)}` : "—", veredicto: !completos || u.liquidez == null || !PC ? "sin_datos" : v(AC / PC >= u.liquidez) },
    { etiqueta: "Nivel de endeudamiento", valor: completos && AT ? PT / AT : null, exigido: u.endeudamiento != null ? `≤ ${fmt(u.endeudamiento)}` : "—", veredicto: !completos || u.endeudamiento == null || !AT ? "sin_datos" : v(PT / AT <= u.endeudamiento) },
    { etiqueta: "Razón de cobertura de intereses", valor: completos && GI ? UO / GI : null, exigido: u.cobertura != null ? `≥ ${fmt(u.cobertura)}` : "—", veredicto: !completos || u.cobertura == null ? "sin_datos" : GI === 0 ? "cumple" : v(UO / GI >= u.cobertura) },
    { etiqueta: e.requisitosFinancieros?.capital_trabajo_suma ? "Capital de trabajo (suma de los integrantes)" : "Capital de trabajo", valor: completos ? CT : null, exigido: u.capitalTrabajo != null ? `≥ ${fmt(u.capitalTrabajo, 0)}` : "—", veredicto: !completos || u.capitalTrabajo == null ? "sin_datos" : v(CT >= u.capitalTrabajo) },
    { etiqueta: "Patrimonio de cada integrante (proporcional a su participación)", valor: null, exigido: u.patrimonio != null && po ? `≥ ${fmt(u.patrimonio, 0)} × su %` : "—", veredicto: peor(finInt.map((f) => f.patrimonioCumple)) },
    { etiqueta: "Rentabilidad del patrimonio", valor: completos && PA ? UO / PA : null, exigido: u.roe != null ? `≥ ${fmt(u.roe)}` : "—", veredicto: !completos || u.roe == null || !PA ? "sin_datos" : v(UO / PA >= u.roe) },
    { etiqueta: "Rentabilidad del activo", valor: completos && AT ? UO / AT : null, exigido: u.roa != null ? `≥ ${fmt(u.roa)}` : "—", veredicto: !completos || u.roa == null || !AT ? "sin_datos" : v(UO / AT >= u.roa) },
  ];
  const cupoItem = e.checklist.find((c) => /cupo de cr[eé]dito|formulario 8/i.test(c.nombre));
  const cupoCredito: Verificacion = e.requiereCupo
    ? { etiqueta: "Cupo de crédito (Formulario 8)", veredicto: cupoItem?.completado ? "cumple" : "sin_datos", detalle: "Requisito adicional: certificación en firme por el 10 % del presupuesto, con correo y teléfono de quien firma." }
    : { etiqueta: "Cupo de crédito (Formulario 8)", veredicto: "cumple", detalle: "La solicitud de este proyecto indica que no aplica cupo de crédito." };
  const veredictoFinanciero = peor([...agrupados.map((a) => a.veredicto), cupoCredito.veredicto]);

  // ---------- Ponderables ----------
  const mujeres = e.integrantes.some((i) => i.empresa.es_empresa_mujeres === true);
  const obras = e.integrantes.map((i) => i.empresa.registra_obras_inconclusas);
  const puntosObras = obras.some((o) => o === true) ? 0 : obras.every((o) => o === false) && n > 0 ? pesos.obras_inconclusas : null;
  const items: Ponderable[] = [
    { etiqueta: "Oferta económica", maximo: pesos.economica, puntos: null, detalle: "Se asigna al abrir el sobre económico, con el método sorteado con la TRM." },
    { etiqueta: "Empresa de mujeres o emprendimiento", maximo: pesos.mujeres, puntos: n === 0 ? null : mujeres ? pesos.mujeres : 0, detalle: mujeres ? "Al menos un integrante está marcado como empresa de mujeres (falta el Formulario 9)." : "Ningún integrante está marcado como empresa de mujeres." },
    { etiqueta: "Obras inconclusas (Contraloría)", maximo: pesos.obras_inconclusas, puntos: puntosObras, detalle: puntosObras == null ? "Sin verificar el registro de la Contraloría de cada integrante." : puntosObras === 0 ? "Un integrante figura con obras inconclusas: 0 puntos para todo el plural." : "Ningún integrante registra obras inconclusas." },
    ...(e.hayProcesosJuridicos
      ? [{ etiqueta: "Procesos jurídicos con la EAAB", maximo: pesos.procesos_juridicos ?? 100, puntos: null, detalle: "Sin verificar: 0 puntos si algún integrante tiene procesos por devolución de anticipos o inejecución." } as Ponderable]
      : []),
  ];
  const puntosParciales = items.reduce((s, i) => s + (i.puntos ?? 0), 0);
  const maximo = items.reduce((s, i) => s + i.maximo, 0);

  // ---------- Causales de rechazo ----------
  const enEjecucionEaab = e.integrantes.map((i) => i.experiencia.filter((x) => x.estado === "en_ejecucion" && PATRON_EAAB.test(x.entidad_contratante)).length);
  const causales: Verificacion[] = [
    {
      etiqueta: "4 o más contratos en ejecución con la EAAB",
      veredicto: n === 0 ? "sin_datos" : enEjecucionEaab.some((c) => c >= 4) ? "no_cumple" : "sin_datos",
      detalle: e.integrantes.map((i, idx) => `${i.empresa.nombre}: ${enEjecucionEaab[idx]} registrados`).join(" · ") + ". La EAAB lo verifica en su sistema; confirma con ellos antes de ofertar.",
    },
    {
      etiqueta: "Experiencia de socios, accionistas o constituyentes",
      veredicto: contratos.length === 0 ? "sin_datos" : contratos.some((c) => c.problemas.includes("El certificado no nombra a esta empresa.")) ? "no_cumple" : "cumple",
      detalle: "No se acepta aunque esté inscrita en el RUP.",
    },
    {
      etiqueta: "Menos de 3 años de constitución con contratos de socios",
      veredicto: "sin_datos",
      detalle: "Verifica la fecha de constitución de cada persona jurídica frente a la experiencia que presenta.",
    },
    {
      etiqueta: "Más de una oferta o integrante en dos ofertas",
      veredicto: "sin_datos",
      detalle: "Confirma que ninguna empresa participe en otra oferta del mismo proceso.",
    },
  ];

  const veredictos = [veredictoJuridico, veredictoTecnico, veredictoFinanciero];
  const conceptoFinal: Veredicto = veredictos.includes("no_cumple") || causales.some((c) => c.veredicto === "no_cumple") ? "no_cumple" : veredictos.every((x) => x === "cumple") ? "cumple" : "sin_datos";

  return {
    integrantes: e.integrantes.map((i) => ({ nombre: i.empresa.nombre, porcentaje: i.porcentaje })),
    juridico: { veredicto: veredictoJuridico, filas, reglasPlural },
    tecnico: { veredicto: veredictoTecnico, contratos, actividades, acreditadoSmmlv, requeridoSmmlv, verificaciones: verificacionesTec },
    financiero: { veredicto: veredictoFinanciero, integrantes: finInt, agrupados, cupoCredito },
    ponderables: { items, puntosParciales, maximo },
    causales,
    conceptoFinal,
  };
}

export async function cargarCalificacion(licitacionId: string): Promise<Calificacion | null> {
  const supabase = createAdminClient();
  const { data: lic } = await supabase.from("licitaciones").select("presupuesto").eq("id", licitacionId).single();
  if (!lic) return null;

  const [{ data: parts }, { data: analisis }, { data: seleccion }, { data: checklist }] = await Promise.all([
    supabase.from("licitacion_participantes").select("empresa_id, porcentaje_participacion").eq("licitacion_id", licitacionId),
    supabase.from("analisis_licitacion").select("requisitos_tecnicos_estructurado, requisitos_financieros_estructurado, requisitos_juridicos, requisitos_financieros").eq("licitacion_id", licitacionId).maybeSingle(),
    supabase.from("licitacion_experiencia_seleccionada").select("experiencia_id, actividad_acreditada").eq("licitacion_id", licitacionId),
    supabase.from("checklist_items").select("*").eq("licitacion_id", licitacionId),
  ]);

  const ids = (parts ?? []).map((p) => p.empresa_id);
  const [{ data: empresas }, { data: docs }, { data: exps }, { data: inds }] = ids.length
    ? await Promise.all([
        supabase.from("empresas").select("*").in("id", ids),
        supabase.from("empresa_documentos").select("*").in("empresa_id", ids),
        supabase.from("experiencia").select("*").in("empresa_id", ids),
        supabase.from("indicadores_financieros").select("*").in("empresa_id", ids).order("periodo", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const expIds = (exps ?? []).map((x) => x.id);
  const { data: certs } = expIds.length
    ? await supabase.from("experiencia_documentos").select("experiencia_id").in("experiencia_id", expIds)
    : { data: [] as { experiencia_id: string }[] };

  const textoJuridico = JSON.stringify(analisis?.requisitos_juridicos ?? []) + JSON.stringify(analisis?.requisitos_financieros ?? []);
  const rf = (analisis?.requisitos_financieros_estructurado ?? null) as RequisitosFinancierosEstructurado | null;

  return calcularCalificacion({
    presupuesto: lic.presupuesto,
    requisitosTecnicos: (analisis?.requisitos_tecnicos_estructurado ?? null) as RequisitosTecnicosEstructurado | null,
    requisitosFinancieros: rf,
    hayProcesosJuridicos: /procesos jur[ií]dicos/i.test(textoJuridico),
    requiereCupo: /cupo de cr[eé]dito/i.test(textoJuridico) && !/no aplica cupo/i.test(textoJuridico),
    integrantes: [...(parts ?? [])]
      .sort((a, b) => Number(b.porcentaje_participacion) - Number(a.porcentaje_participacion))
      .map((p) => ({
        empresa: (empresas ?? []).find((x) => x.id === p.empresa_id) as Empresa,
        porcentaje: Number(p.porcentaje_participacion),
        documentos: ((docs ?? []) as EmpresaDocumento[]).filter((d) => d.empresa_id === p.empresa_id),
        experiencia: ((exps ?? []) as Experiencia[]).filter((x) => x.empresa_id === p.empresa_id),
        indicador: ((inds ?? []) as IndicadorFinanciero[]).find((i) => i.empresa_id === p.empresa_id) ?? null,
      }))
      .filter((i) => i.empresa),
    seleccion: (seleccion ?? []).map((s) => ({ experienciaId: s.experiencia_id, actividad: s.actividad_acreditada })),
    certificados: new Set((certs ?? []).map((c) => c.experiencia_id as string)),
    checklist: (checklist ?? []) as ChecklistItem[],
  });
}
