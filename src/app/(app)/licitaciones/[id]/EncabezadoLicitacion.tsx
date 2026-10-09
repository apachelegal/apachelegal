import Link from "next/link";
import { ArrowLeft, CalendarClock, Users, Wallet, Gauge } from "lucide-react";
import { formatCOP, formatDate } from "@/lib/format";
import { diasHasta } from "@/lib/licitaciones/preparacion";
import type { Licitacion } from "@/lib/types";
import { EstadoSelector } from "./EstadoSelector";
import { DeleteButton } from "./DeleteButton";

function Indicador({
  icono,
  etiqueta,
  children,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icono}
        {etiqueta}
      </p>
      {children}
    </div>
  );
}

export function EncabezadoLicitacion({
  lic,
  porcentaje,
  participantes,
}: {
  lic: Licitacion;
  porcentaje: number;
  participantes: { nombre: string; porcentaje: number }[];
}) {
  const fechaLimite = lic.fecha_cierre ?? lic.fecha_vencimiento;
  const dias = diasHasta(fechaLimite);
  const colorDias =
    dias == null ? "text-slate-500" : dias < 0 ? "text-red-600" : dias <= 7 ? "text-amber-600" : "text-slate-500";
  const textoDias =
    dias == null ? "Sin fecha de cierre" : dias < 0 ? `Cerró hace ${-dias} días` : dias === 0 ? "Cierra hoy" : `Faltan ${dias} días`;
  const colorBarra = porcentaje >= 80 ? "bg-emerald-500" : porcentaje >= 40 ? "bg-blue-500" : "bg-amber-500";

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <Link href="/licitaciones" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft size={14} />
            Licitaciones
          </Link>
          <p className="text-sm font-medium text-blue-700">
            {lic.entidad}
            {lic.numero_proceso && <span className="ml-2 font-normal text-slate-400">· {lic.numero_proceso}</span>}
          </p>
          <h1 className="mt-1 line-clamp-2 text-xl font-semibold leading-snug text-slate-900" title={lic.objeto}>
            {lic.objeto}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <EstadoSelector id={lic.id} estado={lic.estado} />
          <DeleteButton id={lic.id} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador icono={<Wallet size={13} />} etiqueta="Presupuesto oficial">
          <p className="text-lg font-semibold text-slate-900">{formatCOP(lic.presupuesto)}</p>
        </Indicador>
        <Indicador icono={<CalendarClock size={13} />} etiqueta="Cierre">
          <p className="text-lg font-semibold text-slate-900">{fechaLimite ? formatDate(fechaLimite) : "—"}</p>
          <p className={`text-xs font-medium ${colorDias}`}>{textoDias}</p>
        </Indicador>
        <Indicador icono={<Gauge size={13} />} etiqueta="Preparación">
          <p className="text-lg font-semibold text-slate-900">{porcentaje}%</p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${colorBarra}`} style={{ width: `${porcentaje}%` }} />
          </div>
        </Indicador>
        <Indicador icono={<Users size={13} />} etiqueta="Equipo">
          {participantes.length === 0 ? (
            <p className="text-sm text-slate-400">Sin definir</p>
          ) : (
            <ul className="space-y-0.5">
              {participantes.slice(0, 3).map((p) => (
                <li key={p.nombre} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-800">{p.nombre}</span>
                  <span className="shrink-0 text-xs text-slate-500">{p.porcentaje}%</span>
                </li>
              ))}
              {participantes.length > 3 && <li className="text-xs text-slate-400">+{participantes.length - 3} más</li>}
            </ul>
          )}
        </Indicador>
      </div>
    </header>
  );
}
