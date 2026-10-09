import { ClipboardCheck } from "lucide-react";
import { cargarInterventorias } from "@/lib/interventorias/datos";
import { Interventorias } from "./Interventorias";
import { InterventoriasTabs } from "./InterventoriasTabs";

export const dynamic = "force-dynamic";

export default async function InterventoriasPage() {
  const contratos = await cargarInterventorias();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <ClipboardCheck size={24} className="text-blue-600" />
          Interventorías
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Carpeta aparte con los contratos de interventoría y consultoría de todas las empresas y personas, para las
          licitaciones de interventoría. Salen de la experiencia ya cargada; si uno está mal clasificado, cámbialo a la
          derecha. Marca con las etiquetas qué obra supervisó cada contrato (con el certificado a la vista): el evaluador las usa para saber qué actividades acredita. Los certificados se suben desde la ficha de cada empresa.
        </p>
      </div>
      <InterventoriasTabs />
      <Interventorias contratos={contratos} />
    </div>
  );
}
