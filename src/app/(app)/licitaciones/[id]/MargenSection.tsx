"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { formatCOP } from "@/lib/format";
import {
  NIVELES_OFERTA,
  calcularMargen,
  completarSupuestos,
  type Supuestos,
} from "@/lib/presupuesto/margen";
import type { PresupuestoItem } from "@/lib/types";
import { guardarCostoItem, guardarSupuestos } from "./presupuesto-actions";

const millones = (n: number) =>
  `$ ${(n / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 0 })} M`;
const pct = (n: number, d = 1) => `${n.toLocaleString("es-CO", { maximumFractionDigits: d })}%`;

function Campo({
  etiqueta,
  valor,
  onChange,
  paso = 1,
  ayuda,
}: {
  etiqueta: string;
  valor: number;
  onChange: (v: number) => void;
  paso?: number;
  ayuda?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-600" title={ayuda}>
      {etiqueta}
      <input
        type="number"
        step={paso}
        value={Number.isFinite(valor) ? valor : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
      />
    </label>
  );
}

function FilaClave({
  licitacionId,
  item,
  costoLocal,
  fuenteLocal,
  factorOferta,
  onCambio,
}: {
  licitacionId: string;
  item: PresupuestoItem;
  costoLocal: number | null;
  fuenteLocal: string;
  factorOferta: number;
  onCambio: (costo: number | null, fuente: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sucio, setSucio] = useState(false);
  const ofertado = (item.precio_unitario ?? 0) * factorOferta;
  const margen = costoLocal != null && ofertado ? ((ofertado - costoLocal) / ofertado) * 100 : null;

  function guardar() {
    setError(null);
    startTransition(async () => {
      try {
        await guardarCostoItem(licitacionId, item.id, costoLocal, fuenteLocal);
        setSucio(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  return (
    <tr className="align-top">
      <td className="px-3 py-2 font-mono text-slate-700">{item.codigo || "—"}</td>
      <td className="max-w-xs px-3 py-2 text-slate-800">
        {item.descripcion.slice(0, 120)}
        {item.descripcion.length > 120 ? "…" : ""}
      </td>
      <td className="px-3 py-2 text-right text-slate-700">
        {(item.cantidad ?? 0).toLocaleString("es-CO", { maximumFractionDigits: 1 })} {item.unidad}
      </td>
      <td className="px-3 py-2 text-right text-slate-700">{formatCOP(item.precio_unitario)}</td>
      <td className="px-3 py-2 text-right text-slate-900">{formatCOP(ofertado)}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={costoLocal ?? ""}
          placeholder="por cotizar"
          onChange={(e) => {
            setSucio(true);
            onCambio(e.target.value === "" ? null : Number(e.target.value), fuenteLocal);
          }}
          className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-right text-xs"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={fuenteLocal}
          placeholder="cotización, proveedor…"
          onChange={(e) => {
            setSucio(true);
            onCambio(costoLocal, e.target.value);
          }}
          className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-xs"
        />
      </td>
      <td className={`px-3 py-2 text-right font-medium ${margen == null ? "text-slate-400" : margen < 0 ? "text-red-600" : "text-emerald-600"}`}>
        {margen == null ? "—" : pct(margen)}
      </td>
      <td className="px-3 py-2">
        {sucio && (
          <button
            onClick={guardar}
            disabled={isPending}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending && <Loader2 size={12} className="animate-spin" />}
            Guardar
          </button>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export function MargenSection({
  licitacionId,
  items,
  supuestosIniciales,
}: {
  licitacionId: string;
  items: PresupuestoItem[];
  supuestosIniciales: Partial<Supuestos> | null | undefined;
}) {
  const [s, setS] = useState<Supuestos>(() => completarSupuestos(supuestosIniciales));
  const [costos, setCostos] = useState<Record<string, { costo: number | null; fuente: string }>>(() =>
    Object.fromEntries(items.map((i) => [i.id, { costo: i.costo_unitario ?? null, fuente: i.costo_fuente ?? "" }])),
  );
  const [guardando, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  const itemsCalculo = useMemo(
    () => items.map((i) => ({ ...i, costo_unitario: costos[i.id]?.costo ?? null })),
    [items, costos],
  );
  const r = useMemo(() => calcularMargen(itemsCalculo, s), [itemsCalculo, s]);
  const sensibilidad = useMemo(
    () => NIVELES_OFERTA.map((f) => ({ f, r: calcularMargen(itemsCalculo, s, f) })),
    [itemsCalculo, s],
  );
  const clave = useMemo(
    () => [...items].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).slice(0, 15),
    [items],
  );
  const filasFlujo = r.flujo.filas.filter((f) => f.actaBruta > 0 || f.cobro > 0 || f.pagoCostos > 0 || f.devolucionRetencion > 0);
  const maxAbs = Math.max(1, ...r.flujo.filas.map((f) => Math.abs(f.acumulado)));

  const set = <K extends keyof Supuestos>(k: K, v: Supuestos[K]) => setS((prev) => ({ ...prev, [k]: v }));

  function guardarS() {
    setMensaje(null);
    startTransition(async () => {
      try {
        await guardarSupuestos(licitacionId, s);
        setMensaje("Supuestos guardados.");
      } catch (e) {
        setMensaje(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  const utilColor = r.utilidad < 0 ? "text-red-600" : "text-emerald-600";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 flex items-center gap-2 font-medium text-slate-900">
        <TrendingUp size={18} className="text-blue-600" />
        Margen y flujo de caja
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Compara el precio ofertado contra tu costo real. Los ítems sin costo cargado usan el supuesto general, así que
        mientras la cobertura de costos sea baja el resultado es una ilustración, no una proyección.
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Ingreso del contrato</p>
          <p className="text-base font-semibold text-slate-900">{millones(r.ingresoTotal)}</p>
          <p className="text-xs text-slate-400">a {pct(s.porcentaje_oferta * 100, 1)} del precio oficial</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Utilidad neta</p>
          <p className={`text-base font-semibold ${utilColor}`}>{millones(r.utilidad)}</p>
          <p className="text-xs text-slate-400">margen {pct(r.margenPct)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Financiación máxima necesaria</p>
          <p className="text-base font-semibold text-slate-900">{millones(r.flujo.necesidadMaxima)}</p>
          <p className="text-xs text-slate-400">
            mes {r.flujo.mesNecesidadMaxima}
            {r.flujo.mesRecuperacion != null ? `, se recupera en el mes ${r.flujo.mesRecuperacion}` : ""}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs text-slate-500">Punto de equilibrio</p>
          <p className={`text-base font-semibold ${r.puntoEquilibrio > 1 ? "text-red-600" : "text-slate-900"}`}>
            {pct(r.puntoEquilibrio * 100)}
          </p>
          <p className="text-xs text-slate-400">
            {r.puntoEquilibrio > 1 ? "no cubre costos ni al 100% del oficial" : "del precio oficial, utilidad cero"}
          </p>
        </div>
      </div>

      <p className="mb-5 text-xs text-slate-500">
        Cobertura de costos: <span className="font-medium text-slate-700">{pct(r.coberturaCostos * 100, 0)}</span> del costo
        directo tiene un costo cargado; el resto usa el {pct(s.costo_default_pct * 100, 0)} del precio oficial como supuesto.
      </p>

      <div className="mb-5 rounded-lg border border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Sensibilidad al porcentaje de oferta</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-3 font-medium">% del precio oficial</th>
                <th className="py-1 pr-3 text-right font-medium">Ingreso</th>
                <th className="py-1 pr-3 text-right font-medium">Utilidad neta</th>
                <th className="py-1 pr-3 text-right font-medium">Margen</th>
                <th className="py-1 text-right font-medium">Financiación máx.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sensibilidad.map(({ f, r: x }) => (
                <tr key={f}>
                  <td className="py-1.5 pr-3 font-medium text-slate-800">{pct(f * 100, 1)}</td>
                  <td className="py-1.5 pr-3 text-right">{millones(x.ingresoTotal)}</td>
                  <td className={`py-1.5 pr-3 text-right font-medium ${x.utilidad < 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {millones(x.utilidad)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">{pct(x.margenPct)}</td>
                  <td className="py-1.5 text-right">{millones(x.flujo.necesidadMaxima)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Supuestos</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo etiqueta="Oferta / precio oficial (0,90–1,00)" valor={s.porcentaje_oferta} paso={0.005} onChange={(v) => set("porcentaje_oferta", Math.min(1, Math.max(0.9, v)))} ayuda="Cada precio unitario debe estar entre el 90% y el 100% del oficial" />
          <Campo etiqueta="Costo sin cotizar (% del oficial)" valor={s.costo_default_pct * 100} onChange={(v) => set("costo_default_pct", v / 100)} ayuda="Costo directo supuesto de los ítems sin costo cargado" />
          <Campo etiqueta="Administración ofertada (%)" valor={s.admin_ofertada_pct} paso={0.1} onChange={(v) => set("admin_ofertada_pct", v)} />
          <Campo etiqueta="Utilidad ofertada (%)" valor={s.utilidad_ofertada_pct} paso={0.1} onChange={(v) => set("utilidad_ofertada_pct", v)} />
          <Campo etiqueta="Costo real de administración (% del directo)" valor={s.indirectos_reales_pct} paso={0.1} onChange={(v) => set("indirectos_reales_pct", v)} ayuda="Lo que realmente cuesta administrar la obra: personal, oficinas, equipos, seguros" />
          <Campo etiqueta="Impacto urbano (valor global, $)" valor={s.impacto_urbano} paso={1000000} onChange={(v) => set("impacto_urbano", v)} />
          <Campo etiqueta="Plazo de ejecución (meses)" valor={s.plazo_meses} onChange={(v) => set("plazo_meses", Math.max(1, Math.round(v)))} />
          <Campo etiqueta="Anticipo (%)" valor={s.anticipo_pct} onChange={(v) => set("anticipo_pct", v)} />
          <Campo etiqueta="Retención en garantía (%)" valor={s.retencion_pct} paso={0.5} onChange={(v) => set("retencion_pct", v)} />
          <Campo etiqueta="Días hasta el cobro" valor={s.dias_cobro} paso={5} onChange={(v) => set("dias_cobro", v)} ayuda="Radicación + 30 días calendario de pago de la EAAB" />
          <Campo etiqueta="% de costos a crédito" valor={s.pct_costos_credito * 100} onChange={(v) => set("pct_costos_credito", Math.min(1, Math.max(0, v / 100)))} ayuda="Parte de los costos que se paga a proveedores con plazo" />
          <Campo etiqueta="Meses de crédito de proveedores" valor={s.meses_credito} onChange={(v) => set("meses_credito", Math.max(0, Math.round(v)))} />
          <Campo etiqueta="% de costos que son materiales" valor={s.pct_costos_anticipable * 100} onChange={(v) => set("pct_costos_anticipable", Math.min(1, Math.max(0, v / 100)))} ayuda="Solo esta parte puede pagarse con el anticipo: la EAAB prohíbe usarlo en mano de obra y maquinaria" />
          <Campo etiqueta="Costo de financiación (% E.A.)" valor={s.costo_financiero_anual_pct} paso={0.5} onChange={(v) => set("costo_financiero_anual_pct", v)} />
          <Campo etiqueta="Pólizas (% del contrato)" valor={s.costo_polizas_pct} paso={0.1} onChange={(v) => set("costo_polizas_pct", v)} />
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Curva de avance
            <select
              value={s.curva}
              onChange={(e) => set("curva", e.target.value as "s" | "lineal")}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
            >
              <option value="s">Curva en S</option>
              <option value="lineal">Lineal</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={guardarS}
            disabled={guardando}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando && <Loader2 size={14} className="animate-spin" />}
            Guardar supuestos
          </button>
          {mensaje && <span className="text-xs text-slate-500">{mensaje}</span>}
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-slate-200">
        <h3 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">
          Ítems clave: carga tu costo real (los 15 de mayor valor)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Descripción</th>
                <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                <th className="px-3 py-2 text-right font-medium">Precio oficial</th>
                <th className="px-3 py-2 text-right font-medium">Precio ofertado</th>
                <th className="px-3 py-2 font-medium">Costo unitario real</th>
                <th className="px-3 py-2 font-medium">Fuente</th>
                <th className="px-3 py-2 text-right font-medium">Margen</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clave.map((i) => (
                <FilaClave
                  key={i.id}
                  licitacionId={licitacionId}
                  item={i}
                  costoLocal={costos[i.id]?.costo ?? null}
                  fuenteLocal={costos[i.id]?.fuente ?? ""}
                  factorOferta={s.porcentaje_oferta}
                  onCambio={(costo, fuente) => setCostos((prev) => ({ ...prev, [i.id]: { costo, fuente } }))}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Flujo de caja mensual</h3>
        <p className="mb-3 text-xs text-slate-500">
          El anticipo ({s.anticipo_pct}% del contrato) entra al inicio a un encargo fiduciario y solo paga materiales
          ({pct(s.pct_costos_anticipable * 100, 0)} de los costos), no mano de obra ni maquinaria. Cada acta descuenta la
          amortización y la retención, y se cobra {Math.ceil(s.dias_cobro / 30)} mes(es) después. El acumulado es caja
          propia: lo negativo es lo que hay que financiar.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-3 font-medium">Mes</th>
                <th className="py-1 pr-3 text-right font-medium">Avance</th>
                <th className="py-1 pr-3 text-right font-medium">Cobros</th>
                <th className="py-1 pr-3 text-right font-medium">Pagos de costos</th>
                <th className="py-1 pr-3 text-right font-medium">Con anticipo</th>
                <th className="py-1 pr-3 text-right font-medium">Neto</th>
                <th className="py-1 pr-3 text-right font-medium">Acumulado</th>
                <th className="py-1 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filasFlujo.map((f) => (
                <tr key={f.mes}>
                  <td className="py-1 pr-3 font-medium text-slate-800">{f.mes}</td>
                  <td className="py-1 pr-3 text-right">{f.avancePct ? pct(f.avancePct) : "—"}</td>
                  <td className="py-1 pr-3 text-right">{millones(f.cobro + f.devolucionRetencion)}</td>
                  <td className="py-1 pr-3 text-right">{millones(f.pagoCostos)}</td>
                  <td className="py-1 pr-3 text-right text-slate-500">{millones(f.usoAnticipo)}</td>
                  <td className={`py-1 pr-3 text-right ${f.neto < 0 ? "text-red-600" : "text-slate-700"}`}>{millones(f.neto)}</td>
                  <td className={`py-1 pr-3 text-right font-medium ${f.acumulado < 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {millones(f.acumulado)}
                  </td>
                  <td className="w-40 py-1">
                    <div className="h-2 w-full rounded bg-slate-100">
                      <div
                        className={`h-2 rounded ${f.acumulado < 0 ? "bg-red-400" : "bg-emerald-400"}`}
                        style={{ width: `${(Math.abs(f.acumulado) / maxAbs) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Costo de financiación estimado: {millones(r.flujo.costoFinanciero)} · Pólizas: {millones(r.costoPolizas)} · Costo directo:{" "}
          {millones(r.costoDirecto)} · Administración real: {millones(r.costoIndirecto)}
        </p>
      </div>
    </div>
  );
}
