export type TabLicitacion = "resumen" | "requisitos" | "equipo" | "calificacion" | "presupuesto" | "oferta" | "cronograma";

export const TABS_LICITACION: { id: TabLicitacion; etiqueta: string }[] = [
  { id: "resumen", etiqueta: "Resumen" },
  { id: "requisitos", etiqueta: "Requisitos" },
  { id: "equipo", etiqueta: "Equipo" },
  { id: "calificacion", etiqueta: "Calificación" },
  { id: "presupuesto", etiqueta: "Presupuesto" },
  { id: "oferta", etiqueta: "Oferta" },
  { id: "cronograma", etiqueta: "Cronograma" },
];

export type EstadoPaso = "completo" | "en_curso" | "pendiente";

export interface PasoRuta {
  id: "requisitos" | "equipo" | "habilitacion" | "cumplimiento" | "presupuesto" | "oferta" | "cronograma";
  titulo: string;
  detalle: string;
  estado: EstadoPaso;
  /** Avance del paso entre 0 y 1. */
  fraccion: number;
  tab: TabLicitacion;
  /** Qué hacer para avanzar en este paso. */
  accion: string;
}

export interface DatosPreparacion {
  hayPliego: boolean;
  hayPdf: boolean;
  analisisEstado: "pendiente" | "procesando" | "completado" | "error" | null;
  participantes: number;
  sumaParticipacion: number;
  /** Promedio de la carpeta de habilitación de los participantes, 0 a 100, o null si no hay participantes. */
  habilitacionPct: number | null;
  verificacionEstado: "pendiente" | "procesando" | "completado" | "error" | null;
  experienciaSeleccionada: number;
  itemsPresupuesto: number;
  coberturaCostos: number;
  checklistTotal: number;
  checklistHechos: number;
  tareasTotal: number;
  tareasHechas: number;
  tareasVencidas: number;
}

const estadoDe = (fraccion: number): EstadoPaso => (fraccion >= 1 ? "completo" : fraccion > 0 ? "en_curso" : "pendiente");

export function calcularRuta(d: DatosPreparacion): { pasos: PasoRuta[]; porcentaje: number; siguiente: PasoRuta | null } {
  const fRequisitos = d.analisisEstado === "completado" ? 1 : d.hayPliego || d.hayPdf ? 0.5 : 0;
  const equipoOk = d.participantes > 0 && Math.abs(d.sumaParticipacion - 100) < 0.01;
  const fEquipo = equipoOk ? 1 : d.participantes > 0 ? 0.5 : 0;
  const fHabilitacion = d.habilitacionPct == null ? 0 : Math.min(1, d.habilitacionPct / 100);
  const fCumplimiento =
    d.verificacionEstado === "completado" && d.experienciaSeleccionada > 0
      ? 1
      : d.verificacionEstado === "completado" || d.experienciaSeleccionada > 0
        ? 0.5
        : 0;
  const fPresupuesto = d.itemsPresupuesto === 0 ? 0 : d.coberturaCostos >= 0.6 ? 1 : 0.5;
  const fOferta = d.checklistTotal === 0 ? 0 : d.checklistHechos / d.checklistTotal;
  const fCrono = d.tareasTotal === 0 ? 0 : d.tareasHechas / d.tareasTotal;

  const pasos: PasoRuta[] = [
    {
      id: "requisitos",
      titulo: "Pliego y requisitos",
      detalle:
        d.analisisEstado === "completado"
          ? "Pliego analizado"
          : d.hayPliego || d.hayPdf
            ? "Pliego cargado, falta analizarlo"
            : "Sin pliego cargado",
      estado: estadoDe(fRequisitos),
      fraccion: fRequisitos,
      tab: "requisitos",
      accion: d.hayPdf ? "Analiza el pliego con IA para extraer los requisitos." : "Sube el pliego o las condiciones y términos.",
    },
    {
      id: "equipo",
      titulo: "Equipo o consorcio",
      detalle: d.participantes
        ? equipoOk
          ? `${d.participantes} participante${d.participantes === 1 ? "" : "s"}, 100 %`
          : `Participación suma ${d.sumaParticipacion.toLocaleString("es-CO")} %`
        : "Sin participantes",
      estado: estadoDe(fEquipo),
      fraccion: fEquipo,
      tab: "equipo",
      accion: d.participantes ? "Ajusta los porcentajes para que sumen 100 %." : "Define qué empresas presentan la oferta y con qué porcentaje.",
    },
    {
      id: "habilitacion",
      titulo: "Documentos de habilitación",
      detalle: d.habilitacionPct == null ? "Sin equipo definido" : `${Math.round(d.habilitacionPct)} % de la carpeta lista`,
      estado: estadoDe(fHabilitacion),
      fraccion: fHabilitacion,
      tab: "equipo",
      accion: "Completa la carpeta de habilitación de cada participante (RUP, cámara de comercio, RUT y demás).",
    },
    {
      id: "cumplimiento",
      titulo: "Experiencia y cumplimiento",
      detalle:
        d.verificacionEstado === "completado"
          ? `Verificado · ${d.experienciaSeleccionada} contratos elegidos`
          : d.experienciaSeleccionada > 0
            ? `${d.experienciaSeleccionada} contratos elegidos, falta verificar`
            : "Sin verificar",
      estado: estadoDe(fCumplimiento),
      fraccion: fCumplimiento,
      tab: "equipo",
      accion: "Elige los contratos que acreditan la experiencia y verifica el cumplimiento de requisitos.",
    },
    {
      id: "presupuesto",
      titulo: "Presupuesto y margen",
      detalle:
        d.itemsPresupuesto === 0
          ? "Sin presupuesto cargado"
          : `${Math.round(d.coberturaCostos * 100)} % del costo directo con costo real`,
      estado: estadoDe(fPresupuesto),
      fraccion: fPresupuesto,
      tab: "presupuesto",
      accion: d.itemsPresupuesto === 0 ? "Carga el presupuesto oficial de la invitación." : "Carga tus costos reales en los ítems clave para conocer el margen.",
    },
    {
      id: "oferta",
      titulo: "Paquete de la oferta",
      detalle: d.checklistTotal === 0 ? "Sin lista de entregables" : `${d.checklistHechos} de ${d.checklistTotal} entregables`,
      estado: estadoDe(fOferta),
      fraccion: fOferta,
      tab: "oferta",
      accion: d.checklistTotal === 0 ? "Genera la lista de entregables del paquete." : "Completa los entregables pendientes de la lista.",
    },
    {
      id: "cronograma",
      titulo: "Cronograma y tareas",
      detalle:
        d.tareasTotal === 0
          ? "Sin tareas"
          : d.tareasVencidas > 0
            ? `${d.tareasVencidas} tarea${d.tareasVencidas === 1 ? "" : "s"} vencida${d.tareasVencidas === 1 ? "" : "s"}`
            : `${d.tareasHechas} de ${d.tareasTotal} tareas`,
      estado: estadoDe(fCrono),
      fraccion: fCrono,
      tab: "cronograma",
      accion: d.tareasVencidas > 0 ? "Resuelve las tareas vencidas." : "Revisa las fechas clave y asigna responsables.",
    },
  ];

  const porcentaje = Math.round((pasos.reduce((a, p) => a + p.fraccion, 0) / pasos.length) * 100);
  const siguiente = pasos.find((p) => p.estado !== "completo") ?? null;
  return { pasos, porcentaje, siguiente };
}

export function diasHasta(fecha: string | null): number | null {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(fecha + "T00:00:00").getTime() - hoy.getTime()) / 86_400_000);
}
