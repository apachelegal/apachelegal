import type { CoincidenciaSae, PresupuestoItem, SeccionPresupuesto } from "@/lib/types";

const PATRON_SIN_ZANJA =
  /hincad|microt[uú]nel|hidroescudo|pipe ?(ramming|jacking)|sin zanja|perforaci[oó]n dirigida|pozos? de (lanzamiento|recepci[oó]n)|c[aá]maras? (de )?lanzamiento/i;

const total = (items: PresupuestoItem[]) => items.reduce((s, i) => s + (i.total ?? 0), 0);

export interface CoberturaSae {
  coincidencia: CoincidenciaSae;
  items: number;
  valor: number;
  porcentaje: number;
}

export interface AnalisisPresupuesto {
  porSeccion: { seccion: SeccionPresupuesto; items: number; valor: number }[];
  valorObra: number;
  cobertura: CoberturaSae[];
  preciosDistintos: PresupuestoItem[];
  concentracionTop10: { valor: number; porcentaje: number };
  mayores: PresupuestoItem[];
  sinZanja: { items: PresupuestoItem[]; valor: number; porcentajeObra: number };
  /** Los precios unitarios ofertados de obra deben estar entre 90% y 100% del oficial de cada ítem. */
  rangoObra: { piso: number; techo: number };
}

/** Cobertura y hallazgos sobre los ítems de obra, que es donde aplica el rango de precios por ítem. */
export function analizarPresupuesto(items: PresupuestoItem[]): AnalisisPresupuesto {
  const secciones: SeccionPresupuesto[] = ["obra", "suministro", "movilidad", "otros"];
  const porSeccion = secciones
    .map((seccion) => {
      const lista = items.filter((i) => i.seccion === seccion);
      return { seccion, items: lista.length, valor: total(lista) };
    })
    .filter((s) => s.items > 0);

  const obra = items.filter((i) => i.seccion === "obra");
  const valorObra = total(obra);

  const cobertura = (["exacta", "similar", "sin_referencia"] as CoincidenciaSae[]).map((coincidencia) => {
    const lista = obra.filter((i) => i.coincidencia === coincidencia);
    const valor = total(lista);
    return { coincidencia, items: lista.length, valor, porcentaje: valorObra ? (valor / valorObra) * 100 : 0 };
  });

  const preciosDistintos = obra.filter(
    (i) =>
      i.coincidencia === "exacta" &&
      i.precio_unitario != null &&
      i.precio_sae != null &&
      (Math.abs(i.precio_unitario - i.precio_sae) > 0.5 ||
        (i.unidad ?? "").toUpperCase().replace(/\s/g, "") !== (i.unidad_sae ?? "").toUpperCase().replace(/\s/g, "")),
  );

  const mayores = [...obra].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).slice(0, 10);
  const valorTop10 = total(mayores);

  const sinZanjaItems = items.filter((i) => PATRON_SIN_ZANJA.test(i.descripcion) && (i.total ?? 0) > 0);
  const sinZanjaObra = sinZanjaItems.filter((i) => i.seccion === "obra");
  const valorSinZanja = total(sinZanjaObra);

  return {
    porSeccion,
    valorObra,
    cobertura,
    preciosDistintos,
    concentracionTop10: { valor: valorTop10, porcentaje: valorObra ? (valorTop10 / valorObra) * 100 : 0 },
    mayores,
    sinZanja: { items: sinZanjaObra, valor: valorSinZanja, porcentajeObra: valorObra ? (valorSinZanja / valorObra) * 100 : 0 },
    rangoObra: { piso: valorObra * 0.9, techo: valorObra },
  };
}
