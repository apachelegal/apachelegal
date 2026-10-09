import { Network } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { cargarSolicitudes } from "@/lib/control/solicitudes";
import { ControlTabs } from "../ControlTabs";
import { Solicitudes } from "./Solicitudes";

export default async function SolicitudesPage() {
  const supabase = createAdminClient();
  const [{ disponible, solicitudes }, { data: empresas }] = await Promise.all([
    cargarSolicitudes(),
    supabase.from("empresas").select("id, nombre, categoria, tipo_persona, archivada").order("nombre"),
  ]);
  const activas = (empresas ?? [])
    .filter((e) => !e.archivada)
    .map((e) => ({ id: e.id as string, nombre: e.nombre as string, categoria: e.categoria as string, natural: e.tipo_persona === "natural" }))
    .sort((a, b) => (a.categoria === b.categoria ? a.nombre.localeCompare(b.nombre) : a.categoria === "grupo" ? -1 : 1));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <Network size={24} className="text-blue-600" />
          Control de socios
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Lo que hay que pedirle a cada empresa o persona natural, lo que ya se pidió y lo que ya llegó. «Generar
          pendientes» revisa los vacíos de cada una y arma la lista.
        </p>
      </div>
      <ControlTabs />
      {disponible ? (
        <Solicitudes empresas={activas} solicitudes={solicitudes} />
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-medium">Falta crear la tabla de solicitudes.</p>
          <p className="mt-1">
            Abre el SQL Editor de Supabase y corre el bloque «Migración: control de solicitudes a socios» del final de{" "}
            <code>supabase/schema.sql</code>. Después recarga esta página.
          </p>
        </div>
      )}
    </div>
  );
}
