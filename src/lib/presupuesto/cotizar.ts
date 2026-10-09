import type { PresupuestoItem } from "@/lib/types";

export type RubroCotizacion =
  | "Instalación sin zanja"
  | "Mano de obra, equipos y transporte"
  | "Excavación, entibado y disposición"
  | "Agregados, pavimento y mezcla asfáltica"
  | "Tubería, válvulas y accesorios"
  | "Concreto y acero de refuerzo"
  | "Movilidad y señalización"
  | "Otros";

// El orden importa: la primera regla que coincide define el rubro.
const REGLAS_RUBRO: [RegExp, RubroCotizacion][] = [
  [/hincad|microt[uú]nel|pipe ?ramming|jacking|sin zanja|perforaci[oó]n dirigida|liner|pozos? de (ataque|empuje|recibo|lanzamiento)/i, "Instalación sin zanja"],
  [/servicios? de (soldadura|alquiler|transporte)|alquiler|oficial|ayudante|soldadura|transporte especializado|hora[- ]?hombre|retroexcavadora|compresor|martillo|planta el[eé]ctrica/i, "Mano de obra, equipos y transporte"],
  [/excavaci[oó]n|retiro|disposici[oó]n|botadero|entibado|demolici[oó]n|bombeo|escombro/i, "Excavación, entibado y disposición"],
  [/asfalt|mezcla|carpeta|pavimento|base granular|sub-?base|recebo|grava|triturado|arena|agregado|sardinel|and[eé]n|adoqu/i, "Agregados, pavimento y mezcla asfáltica"],
  [/tuber[ií]a|chicote|v[aá]lvula|codo|bridas?|junta|reducci[oó]n|acople|hidrante|ventosa|wsp|ccp|pccp|accesorio|desmontaje|kit rep/i, "Tubería, válvulas y accesorios"],
  [/concreto|mortero|varilla|acero|refuerzo|formaleta|c[aá]mara|atraque|tanque|box culvert|[aá]ngulo/i, "Concreto y acero de refuerzo"],
  [/pmt|se[nñ]aliza|cerramiento|desv[ií]o|movilidad|tr[aá]nsito/i, "Movilidad y señalización"],
];

export function rubroDe(item: Pick<PresupuestoItem, "descripcion" | "seccion">): RubroCotizacion {
  if (item.seccion === "movilidad") return "Movilidad y señalización";
  for (const [re, rubro] of REGLAS_RUBRO) if (re.test(item.descripcion)) return rubro;
  return item.seccion === "suministro" ? "Tubería, válvulas y accesorios" : "Otros";
}

export interface ItemACotizar {
  item: PresupuestoItem;
  rubro: RubroCotizacion;
  /** Fracción del costo directo total del presupuesto. */
  participacion: number;
  acumulada: number;
  motivos: string[];
  cotizado: boolean;
}

export interface ListaCotizacion {
  items: ItemACotizar[];
  costoDirectoTotal: number;
  /** Fracción del costo directo cubierta por los ítems de la lista. */
  cobertura: number;
  /** Fracción del costo directo que ya tiene costo cargado. */
  cargado: number;
}

const total = (i: PresupuestoItem) => i.total ?? (i.precio_unitario ?? 0) * (i.cantidad ?? 0);

/**
 * Ítems que hay que cotizar primero: los que más pesan en el costo directo hasta cubrir `objetivo`
 * (o `max` ítems), más los de precio propio sin referencia SAE con peso relevante, porque ahí el
 * costo real es más incierto.
 */
export function armarListaCotizacion(
  items: PresupuestoItem[],
  { objetivo = 0.8, max = 30, minPropio = 0.01 }: { objetivo?: number; max?: number; minPropio?: number } = {},
): ListaCotizacion {
  const costoDirectoTotal = items.reduce((a, i) => a + total(i), 0);
  const ordenados = [...items].filter((i) => total(i) > 0).sort((a, b) => total(b) - total(a));

  const elegidos = new Map<string, PresupuestoItem>();
  let acum = 0;
  for (const i of ordenados) {
    if (elegidos.size >= max || acum >= objetivo * costoDirectoTotal) break;
    elegidos.set(i.id, i);
    acum += total(i);
  }
  for (const i of ordenados) {
    if (!elegidos.has(i.id) && i.coincidencia === "sin_referencia" && total(i) >= minPropio * costoDirectoTotal) {
      elegidos.set(i.id, i);
    }
  }

  let acumulada = 0;
  const lista: ItemACotizar[] = [...elegidos.values()]
    .sort((a, b) => total(b) - total(a))
    .map((item) => {
      const participacion = costoDirectoTotal ? total(item) / costoDirectoTotal : 0;
      acumulada += participacion;
      const motivos: string[] = [];
      if (participacion >= 0.05) motivos.push("Pesa más del 5% del costo directo");
      if (item.coincidencia === "sin_referencia") motivos.push("Precio propio, sin referencia SAE");
      else if (item.coincidencia === "similar") motivos.push("Referencia SAE solo aproximada");
      if (/nocturn/i.test(item.descripcion)) motivos.push("Jornada nocturna (sobrecosto)");
      if (rubroDe(item) === "Instalación sin zanja") motivos.push("Instalación sin zanja: pocos proveedores");
      if (item.seccion === "suministro") motivos.push("Suministro: cotiza el material puesto en obra");
      return { item, rubro: rubroDe(item), participacion, acumulada, motivos, cotizado: item.costo_unitario != null };
    });

  const cargadoValor = items.reduce(
    (a, i) => a + (i.costo_unitario != null ? i.costo_unitario * (i.cantidad ?? 0) : 0),
    0,
  );
  return {
    items: lista,
    costoDirectoTotal,
    cobertura: acumulada,
    cargado: costoDirectoTotal ? cargadoValor / costoDirectoTotal : 0,
  };
}
