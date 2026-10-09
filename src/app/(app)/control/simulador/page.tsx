import { FlaskConical, Network } from "lucide-react";
import { cargarControl } from "@/lib/control/datos";
import type { Miembro } from "@/lib/control/tipos";
import { ControlTabs } from "../ControlTabs";
import { Simulador } from "./Simulador";

export default async function SimuladorPage({ searchParams }: { searchParams: Promise<{ proceso?: string; e?: string }> }) {
  const { proceso, e } = await searchParams;
  const datos = await cargarControl();

  const conActividades = datos.procesos.filter((p) => p.actividades.length > 0);
  const elegido =
    datos.procesos.find((p) => p.id === proceso) ??
    conActividades.find((p) => p.equipoActual.length > 0) ??
    conActividades[0] ??
    datos.procesos[0];

  const ids = (e ?? "").split(",").filter((id) => datos.empresas.some((x) => x.id === id)).slice(0, 3);
  const reparto = ids.length === 1 ? [100] : ids.length === 2 ? [75, 25] : [50, 25, 25];
  const inicial: Miembro[] =
    ids.length > 0
      ? ids.map((id, i) => ({ empresaId: id, pct: reparto[i] }))
      : (elegido?.equipoActual ?? []).filter((m) => datos.empresas.some((x) => x.id === m.empresaId));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <Network size={24} className="text-blue-600" />
          Control de socios
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          <FlaskConical size={14} className="mr-1 inline text-blue-600" />
          Arma un consorcio con hasta tres integrantes, mueve los porcentajes y mira al instante si cumple lo financiero
          y qué actividades quedan cubiertas, con qué nivel de certeza.
        </p>
      </div>
      <ControlTabs />
      {elegido ? (
        <Simulador datos={datos} procesoInicial={elegido.id} miembrosIniciales={inicial} />
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No hay licitaciones con requisitos estructurados para simular. Analiza primero un pliego con IA.
        </p>
      )}
    </div>
  );
}
