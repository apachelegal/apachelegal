"use client";

import { useState, useTransition } from "react";
import { ListPlus, Loader2 } from "lucide-react";
import { cargarEntregablesEaab } from "./formatos-actions";

export function BotonCargarEntregables({ licitacionId }: { licitacionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() =>
          startTransition(async () => {
            try {
              const n = await cargarEntregablesEaab(licitacionId);
              setMensaje(n === 0 ? "El paquete ya tiene todos los entregables." : `Se agregaron ${n} entregables al paquete.`);
            } catch (e) {
              setMensaje(e instanceof Error ? e.message : "Error al cargar los entregables");
            }
          })
        }
        disabled={isPending}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? <Loader2 size={15} className="animate-spin" /> : <ListPlus size={15} />}
        Cargar entregables de la EAAB al paquete
      </button>
      {mensaje && <span className="text-xs text-slate-500">{mensaje}</span>}
    </div>
  );
}
