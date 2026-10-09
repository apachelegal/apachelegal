import { AlertTriangle, Download, FileSpreadsheet, FileText, Sparkles } from "lucide-react";
import { cargarDatosFormulario10 } from "@/lib/eaab/formulario10";
import { FORMATOS_EAAB, PROCESO_FORMATOS, type FormatoEaab } from "@/lib/eaab/formatos";
import { BotonCargarEntregables } from "./BotonCargarEntregables";

function Etiqueta({ children, tono }: { children: React.ReactNode; tono: "azul" | "gris" | "ambar" }) {
  const c = { azul: "bg-blue-50 text-blue-700", gris: "bg-slate-100 text-slate-600", ambar: "bg-amber-50 text-amber-700" }[tono];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}

function Fila({ licitacionId, f }: { licitacionId: string; f: FormatoEaab }) {
  const Icono = f.archivo.endsWith(".xlsx") ? FileSpreadsheet : FileText;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Icono size={15} className="shrink-0 text-slate-400" />
          <p className="text-sm font-medium text-slate-900">{f.nombre}</p>
          {f.obligatorio && <Etiqueta tono="azul">Obligatorio</Etiqueta>}
          {f.condicion && <Etiqueta tono="gris">{f.condicion}</Etiqueta>}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{f.nota}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {f.generable === "formulario10" && (
          <>
            <a
              href={`/licitaciones/${licitacionId}/formulario10`}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Sparkles size={13} />
              Generar diligenciado
            </a>
            <a
              href={`/licitaciones/${licitacionId}/formulario10?soporte=1`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Soporte interno
            </a>
          </>
        )}
        <a
          href={`/licitaciones/${licitacionId}/formato/${f.id}`}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download size={13} />
          Plantilla
        </a>
      </div>
    </li>
  );
}

export async function FormatosEaabSection({ licitacionId }: { licitacionId: string }) {
  const datos = await cargarDatosFormulario10(licitacionId);
  const advertencias = datos?.advertencias ?? [];
  const oferta = FORMATOS_EAAB.filter((f) => f.entrega === "oferta");
  const referencia = FORMATOS_EAAB.filter((f) => f.entrega !== "oferta");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Formatos oficiales de la EAAB</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Tomados del paquete de la invitación {PROCESO_FORMATOS}. Cada proceso puede ajustarlos: al publicarse la invitación
            real, confirma que sigan siendo los mismos.
          </p>
        </div>
        <BotonCargarEntregables licitacionId={licitacionId} />
      </div>

      {advertencias.length > 0 && (
        <details className="border-b border-amber-100 bg-amber-50 px-5 py-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle size={15} />
            {advertencias.length} pendientes antes de presentar el Formulario 10
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-xs text-amber-900">
            {advertencias.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}

      <h3 className="px-5 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-slate-400">Se entregan con la oferta</h3>
      <ul className="divide-y divide-slate-100">
        {oferta.map((f) => (
          <Fila key={f.id} licitacionId={licitacionId} f={f} />
        ))}
      </ul>
      <h3 className="border-t border-slate-100 px-5 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
        Anexos de referencia y del contrato
      </h3>
      <ul className="divide-y divide-slate-100">
        {referencia.map((f) => (
          <Fila key={f.id} licitacionId={licitacionId} f={f} />
        ))}
      </ul>
    </section>
  );
}
