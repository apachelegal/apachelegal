"use client";

import { useState, useTransition } from "react";
import { Download, ListChecks, Check } from "lucide-react";
import { formatCOP } from "@/lib/format";
import type { ItemACotizar } from "@/lib/presupuesto/cotizar";
import { guardarCostoItem } from "./presupuesto-actions";

const pct = (n: number, d = 1) => `${(n * 100).toLocaleString("es-CO", { maximumFractionDigits: d })}%`;

function FilaCotizar({ licitacionId, x }: { licitacionId: string; x: ItemACotizar }) {
  const { item } = x;
  const [costo, setCosto] = useState(item.costo_unitario != null ? String(item.costo_unitario) : "");
  const [fuente, setFuente] = useState(item.costo_fuente ?? "");
  const [guardado, setGuardado] = useState(item.costo_unitario != null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const guardar = () => {
    setError(null);
    const valor = costo.trim() === "" ? null : Number(costo.replace(/\./g, "").replace(",", "."));
    if (valor != null && (!Number.isFinite(valor) || valor < 0)) {
      setError("Valor no válido");
      return;
    }
    iniciar(async () => {
      try {
        await guardarCostoItem(licitacionId, item.id, valor, fuente || null);
        setGuardado(valor != null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar");
      }
    });
  };

  const ratio =
    item.costo_unitario != null && item.precio_unitario
      ? item.costo_unitario / item.precio_unitario
      : null;

  return (
    <tr className="align-top">
      <td className="px-3 py-2">
        <p className="whitespace-nowrap font-mono text-[11px] text-slate-600">{item.codigo || "—"}</p>
        <p className="max-w-md text-xs text-slate-800">{item.descripcion}</p>
        {x.motivos.length > 0 && (
          <p className="mt-1 text-[11px] text-amber-700">{x.motivos.join(" · ")}</p>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-700">
        {(item.cantidad ?? 0).toLocaleString("es-CO", { maximumFractionDigits: 2 })} {item.unidad}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-900">
        {formatCOP(item.precio_unitario)}
        <p className="text-[11px] text-slate-400">{pct(x.participacion)} del costo</p>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <input
            inputMode="decimal"
            value={costo}
            onChange={(e) => {
              setCosto(e.target.value);
              setGuardado(false);
            }}
            placeholder="Costo unitario"
            className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-right text-xs"
          />
          <input
            value={fuente}
            onChange={(e) => {
              setFuente(e.target.value);
              setGuardado(false);
            }}
            placeholder="Proveedor / cotización"
            className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-xs"
          />
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs">
        <button
          onClick={guardar}
          disabled={pendiente}
          className="rounded-lg bg-blue-600 px-2.5 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {guardado && (
          <p className="mt-1 flex items-center gap-1 text-emerald-700">
            <Check size={12} /> {ratio != null ? `${pct(ratio, 0)} del oficial` : "Guardado"}
          </p>
        )}
        {error && <p className="mt-1 text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export function CotizacionesSection({
  licitacionId,
  lista,
}: {
  licitacionId: string;
  lista: { items: ItemACotizar[]; cobertura: number; cargado: number };
}) {
  const grupos = new Map<string, ItemACotizar[]>();
  for (const x of lista.items) grupos.set(x.rubro, [...(grupos.get(x.rubro) ?? []), x]);
  const cotizados = lista.items.filter((x) => x.cotizado).length;

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ListChecks size={16} className="text-blue-600" /> Ítems a cotizar
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {lista.items.length} ítems que cubren {pct(lista.cobertura, 0)} del costo directo. Cotizados:{" "}
            {cotizados} de {lista.items.length} · costo real cargado en {pct(lista.cargado, 0)} del presupuesto.
            Al guardar un costo, el margen y el flujo de caja se recalculan.
          </p>
        </div>
        <a
          href={`/licitaciones/${licitacionId}/cotizaciones`}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download size={14} /> Solicitud para proveedores (Excel)
        </a>
      </div>

      <div className="divide-y divide-slate-100">
        {[...grupos.entries()].map(([rubro, filas]) => (
          <details key={rubro} open className="group">
            <summary className="flex cursor-pointer items-center justify-between bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
              <span>
                {rubro} <span className="font-normal text-slate-400">· {filas.length} ítems</span>
              </span>
              <span className="font-normal text-slate-500">
                {pct(filas.reduce((a, f) => a + f.participacion, 0))} del costo · cotizados{" "}
                {filas.filter((f) => f.cotizado).length}/{filas.length}
              </span>
            </summary>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[11px] text-slate-400">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">Ítem</th>
                    <th className="px-3 py-1.5 text-right font-medium">Cantidad</th>
                    <th className="px-3 py-1.5 text-right font-medium">Precio oficial</th>
                    <th className="px-3 py-1.5 font-medium">Tu costo real</th>
                    <th className="px-3 py-1.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filas.map((x) => (
                    <FilaCotizar key={x.item.id} licitacionId={licitacionId} x={x} />
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
