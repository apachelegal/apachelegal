export function formatCOP(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(value: string | null): string {
  if (!value) return "—";
  if (!ISO_DATE.test(value)) return value;

  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function daysUntil(value: string | null): number | null {
  if (!value || !ISO_DATE.test(value)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value + "T00:00:00");
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
