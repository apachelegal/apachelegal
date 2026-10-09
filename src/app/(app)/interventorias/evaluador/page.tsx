import { ClipboardCheck } from "lucide-react";
import { cargarInterventorias } from "@/lib/interventorias/datos";
import { InterventoriasTabs } from "../InterventoriasTabs";
import { Evaluador } from "./Evaluador";

export const dynamic = "force-dynamic";

export default async function EvaluadorPage() {
  const contratos = await cargarInterventorias();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <ClipboardCheck size={24} className="text-blue-600" />
          Interventorías
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Evalúa la experiencia habilitante de una invitación de interventoría: escribe el presupuesto y las actividades
          que pide el pliego, arma el equipo y mira qué contratos elegiría la EAAB, qué falta y qué hay que confirmar con
          los certificados. Aquí no se evalúa la parte financiera.
        </p>
      </div>
      <InterventoriasTabs />
      <Evaluador contratos={contratos} />
    </div>
  );
}
