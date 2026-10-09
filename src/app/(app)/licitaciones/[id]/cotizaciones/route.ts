import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createAdminClient } from "@/lib/supabase/admin";
import { armarListaCotizacion } from "@/lib/presupuesto/cotizar";
import type { PresupuestoItem } from "@/lib/types";

/**
 * Solicitud de cotización para enviar a proveedores. No incluye los precios oficiales ni el
 * presupuesto de la entidad: solo la descripción, unidad y cantidad, agrupadas por rubro.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const [{ data: lic }, { data: items }] = await Promise.all([
    supabase.from("licitaciones").select("numero_proceso, objeto, entidad").eq("id", id).maybeSingle(),
    supabase.from("presupuesto_items").select("*").eq("licitacion_id", id).limit(5000),
  ]);
  if (!lic) return NextResponse.json({ error: "Licitación no encontrada" }, { status: 404 });

  const lista = armarListaCotizacion((items ?? []) as PresupuestoItem[]);
  if (lista.items.length === 0) return NextResponse.json({ error: "Sin presupuesto cargado" }, { status: 404 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Solicitud de cotización");
  ws.columns = [
    { header: "Rubro", width: 30 },
    { header: "Ref.", width: 16 },
    { header: "Descripción", width: 70 },
    { header: "Unidad", width: 10 },
    { header: "Cantidad", width: 14 },
    { header: "Valor unitario (sin IVA)", width: 22 },
    { header: "IVA %", width: 8 },
    { header: "Plazo de entrega (días)", width: 18 },
    { header: "Vigencia de la oferta (días)", width: 18 },
    { header: "Condiciones de pago / observaciones", width: 40 },
  ];
  ws.insertRow(1, [`Solicitud de cotización — ${lic.objeto ?? ""}`]);
  ws.insertRow(2, ["Proyecto de referencia: " + (lic.numero_proceso ?? lic.entidad ?? "")]);
  ws.insertRow(3, ["Proveedor:", "", "", "Contacto:", "", "Fecha:"]);
  ws.mergeCells("A1:J1");
  ws.mergeCells("A2:J2");
  ws.getRow(1).font = { bold: true, size: 13 };
  const cabecera = ws.getRow(4);
  cabecera.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cabecera.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
  cabecera.alignment = { wrapText: true, vertical: "middle" };

  const ordenados = [...lista.items].sort((a, b) => a.rubro.localeCompare(b.rubro) || b.participacion - a.participacion);
  for (const x of ordenados) {
    const fila = ws.addRow([
      x.rubro,
      x.item.codigo ?? "",
      x.item.descripcion,
      x.item.unidad ?? "",
      x.item.cantidad ?? 0,
      null,
      null,
      null,
      null,
      null,
    ]);
    fila.getCell(3).alignment = { wrapText: true, vertical: "top" };
    fila.getCell(5).numFmt = "#,##0.00";
    fila.getCell(6).numFmt = "#,##0";
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const base = (lic.numero_proceso ?? "licitacion").replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}_solicitud_cotizacion.xlsx"`,
    },
  });
}
