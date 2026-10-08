import { ETAPA_CASO_LABELS, ESTADO_CASO_LABELS, type Caso } from "@/lib/casos";

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

/** Campos de la ficha del caso, compartidos por el formulario de creación y el de edición. */
export function CasoCampos({ caso }: { caso?: Caso }) {
  return (
    <>
      <Field label="Título del caso" name="titulo" required defaultValue={caso?.titulo} placeholder="Ej. CONINGMA vs Consorcio Redes Norte24" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente" name="cliente" defaultValue={caso?.cliente} placeholder="A quién representamos" />
        <Field label="Contraparte" name="contraparte" defaultValue={caso?.contraparte} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contrato" name="contrato" defaultValue={caso?.contrato} placeholder="Número del contrato" />
        <Field label="Entidad / dueño de la obra" name="entidad" defaultValue={caso?.entidad} placeholder="Ej. EAAB-ESP" />
      </div>
      <Field label="Objeto" name="objeto" as="textarea" defaultValue={caso?.objeto} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Valor (COP)" name="valor" type="number" defaultValue={caso?.valor?.toString()} />
        <Field label="Responsable" name="responsable" defaultValue={caso?.responsable} />
        <Field label="Fecha de inicio" name="fecha_inicio" type="date" defaultValue={caso?.fecha_inicio} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Etapa" name="etapa" labels={ETAPA_CASO_LABELS} defaultValue={caso?.etapa ?? "analisis"} />
        <Select label="Estado" name="estado" labels={ESTADO_CASO_LABELS} defaultValue={caso?.estado ?? "activo"} />
      </div>
      <Field label="Resumen del caso" name="resumen" as="textarea" defaultValue={caso?.resumen} placeholder="Qué pasó y en qué está" />
      <Field label="Posición y estrategia" name="posicion" as="textarea" defaultValue={caso?.posicion} placeholder="Argumentos fuertes, puntos débiles, estrategia" />
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  as,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  as?: "textarea";
  defaultValue?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {as === "textarea" ? (
        <textarea
          id={name}
          name={name}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue ?? ""}
          rows={3}
          className={inputClass}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue ?? ""}
          className={inputClass}
        />
      )}
    </div>
  );
}

function Select({
  label,
  name,
  labels,
  defaultValue,
}: {
  label: string;
  name: string;
  labels: Record<string, string>;
  defaultValue: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue} className={inputClass}>
        {Object.entries(labels).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
