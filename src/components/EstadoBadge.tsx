import { ESTADO_LABELS, type EstadoLicitacion } from "@/lib/types";

const ESTADO_STYLES: Record<EstadoLicitacion, string> = {
  en_estudio: "bg-slate-100 text-slate-700",
  en_elaboracion: "bg-amber-100 text-amber-700",
  presentada: "bg-blue-100 text-blue-700",
  adjudicada: "bg-emerald-100 text-emerald-700",
  perdida: "bg-red-100 text-red-700",
  cancelada: "bg-slate-100 text-slate-500 line-through",
};

export function EstadoBadge({ estado }: { estado: EstadoLicitacion }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_STYLES[estado]}`}
    >
      {ESTADO_LABELS[estado]}
    </span>
  );
}
