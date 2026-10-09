"use client";

import { useMemo, useState } from "react";
import { formatCOP } from "@/lib/format";
import type { CoincidenciaSae, PresupuestoItem, SeccionPresupuesto } from "@/lib/types";

const LIMITE = 60;

const BADGE: Record<CoincidenciaSae, { texto: string; clase: string }> = {
  exacta: { texto: "SAE", clase: "bg-emerald-50 text-emerald-700" },
  similar: { texto: "Similar", clase: "bg-blue-50 text-blue-700" },
  sin_referencia: { texto: "Sin referencia", clase: "bg-amber-50 text-amber-700" },
};

const num = (n: number | null, d = 2) =>
  n == null ? "—" : n.toLocaleString("es-CO", { maximumFractionDigits: d });

export function PresupuestoTabla({ items }: { items: PresupuestoItem[] }) {
  const [seccion, setSeccion] = useState<SeccionPresupuesto | "todas">("obra");
  const [coincidencia, setCoincidencia] = useState<CoincidenciaSae | "todas">("todas");
  const [soloDistintos, setSoloDistintos] = useState(false);
  const [q, setQ] = useState("");
  const [verTodos, setVerTodos] = useState(false);

  const filtrados = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return items
      .filter((i) => seccion === "todas" || i.seccion === seccion)
      .filter((i) => coincidencia === "todas" || i.coincidencia === coincidencia)
      .filter((i) => !soloDistintos || (i.precio_sae != null && i.precio_unitario != null && Math.abs(i.precio_unitario - i.precio_sae) > 0.5))
      .filter((i) => !texto || `${i.codigo ?? ""} ${i.descripcion}`.toLowerCase().includes(texto))
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  }, [items, seccion, coincidencia, soloDistintos, q]);

  const visibles = verTodos ? filtrados : filtrados.slice(0, LIMITE);
  const suma = filtrados.reduce((s, i) => s + (i.total ?? 0), 0);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-800">Ítems del presupuesto</h3>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Sección
          <select
            value={seccion}
            onChange={(e) => setSeccion(e.target.value as SeccionPresupuesto | "todas")}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
          >
            <option value="todas">Todas</option>
            <option value="obra">Obra</option>
            <option value="suministro">Suministros</option>
            <option value="movilidad">Movilidad / PMT</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Referencia SAE
          <select
            value={coincidencia}
            onChange={(e) => setCoincidencia(e.target.value as CoincidenciaSae | "todas")}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
          >
            <option value="todas">Todas</option>
            <option value="exacta">Con código SAE</option>
            <option value="similar">Similar</option>
            <option value="sin_referencia">Sin referencia</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Buscar
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="código o descripción"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal"
          />
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={soloDistintos} onChange={(e) => setSoloDistintos(e.target.checked)} />
          Solo precio distinto al SAE
        </label>
      </div>

      <p className="mb-2 text-xs text-slate-500">
        {filtrados.length} ítems · {formatCOP(suma)}
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Descripción</th>
              <th className="px-3 py-2 font-medium">Und</th>
              <th className="px-3 py-2 text-right font-medium">Cantidad</th>
              <th className="px-3 py-2 text-right font-medium">Precio oficial</th>
              <th className="px-3 py-2 text-right font-medium">Precio SAE</th>
              <th className="px-3 py-2 text-right font-medium">Rango oferta (90–100%)</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Ref.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {visibles.map((i) => {
              const dif =
                i.precio_sae != null && i.precio_unitario != null && i.precio_sae !== 0
                  ? ((i.precio_unitario - i.precio_sae) / i.precio_sae) * 100
                  : null;
              const badge = BADGE[i.coincidencia];
              return (
                <tr key={i.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-700">{i.codigo || "—"}</td>
                  <td className="max-w-md px-3 py-2 text-slate-800">{i.descripcion}</td>
                  <td className="px-3 py-2 text-slate-600">{i.unidad}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{num(i.cantidad)}</td>
                  <td className="px-3 py-2 text-right text-slate-900">{formatCOP(i.precio_unitario)}</td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {i.precio_sae != null ? formatCOP(i.precio_sae) : "—"}
                    {dif != null && Math.abs(dif) > 0.05 && (
                      <span className={`ml-1 ${dif > 0 ? "text-amber-600" : "text-blue-600"}`}>
                        {dif > 0 ? "+" : ""}
                        {dif.toLocaleString("es-CO", { maximumFractionDigits: 0 })}%
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-slate-500">
                    {i.precio_unitario != null
                      ? `${formatCOP(i.precio_unitario * 0.9)} – ${formatCOP(i.precio_unitario)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCOP(i.total)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 ${badge.clase}`}>{badge.texto}</span>
                    {i.coincidencia === "similar" && i.codigo_sae && (
                      <p className="mt-1 text-slate-400">{i.codigo_sae}</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtrados.length > LIMITE && (
        <button
          onClick={() => setVerTodos((v) => !v)}
          className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
        >
          {verTodos ? "Mostrar menos" : `Ver los ${filtrados.length} ítems`}
        </button>
      )}
    </div>
  );
}
