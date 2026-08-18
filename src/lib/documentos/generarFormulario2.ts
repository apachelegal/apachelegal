import ExcelJS from "exceljs";
import type { Experiencia, IndicadorFinanciero } from "@/lib/types";

export interface ParticipanteFormulario2 {
  nombre: string;
  nitOCedula: string | null;
  porcentajeParticipacion: number;
  indicador: IndicadorFinanciero | null;
  experiencia: Experiencia[];
}

function estiloEncabezadoSeccion(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 11 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } };
}

function estiloEncabezadoColumna(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 9 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
  cell.alignment = { wrapText: true, vertical: "middle" };
  cell.border = { bottom: { style: "thin" } };
}

export async function generarFormulario2(
  entidadNombre: string,
  numeroProceso: string | null,
  objeto: string,
  participantes: ParticipanteFormulario2[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Formulario 2", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [{ width: 4 }, ...Array(12).fill({ width: 16 })];

  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value = "FORMULARIO No. 2 - REQUISITOS TÉCNICOS Y CAPACIDAD FINANCIERA";
  sheet.getCell("A1").font = { bold: true, size: 12 };

  sheet.mergeCells("A2:E2");
  sheet.getCell("A2").value = `INVITACIÓN PÚBLICA ${numeroProceso ?? ""}`.trim();
  sheet.mergeCells("A3:E3");
  sheet.getCell("A3").value = `OBJETO: ${objeto}`;
  sheet.getCell("A3").alignment = { wrapText: true };

  sheet.mergeCells("A5:E5");
  sheet.getCell("A5").value = `NOMBRE DE OFERENTE: ${entidadNombre}`;
  estiloEncabezadoSeccion(sheet.getCell("A5"));

  let fila = 7;

  sheet.getCell(`A${fila}`).value = "Integrantes";
  sheet.getCell(`B${fila}`).value = "Nombre del integrante";
  sheet.getCell(`C${fila}`).value = "NIT o Cédula de ciudadanía";
  sheet.getCell(`D${fila}`).value = "% de Participación";
  ["A", "B", "C", "D"].forEach((col) => estiloEncabezadoColumna(sheet.getCell(`${col}${fila}`)));
  fila++;

  participantes.forEach((p, i) => {
    sheet.getCell(`A${fila}`).value = `Integrante ${i + 1}`;
    sheet.getCell(`B${fila}`).value = p.nombre;
    sheet.getCell(`C${fila}`).value = p.nitOCedula ?? "";
    sheet.getCell(`D${fila}`).value = p.porcentajeParticipacion / 100;
    sheet.getCell(`D${fila}`).numFmt = "0.00%";
    fila++;
  });

  fila += 2;
  sheet.mergeCells(`A${fila}:N${fila}`);
  sheet.getCell(`A${fila}`).value = "CAPACIDAD TÉCNICA — EXPERIENCIA";
  estiloEncabezadoSeccion(sheet.getCell(`A${fila}`));
  fila++;

  const encabezadosExperiencia = [
    "N° de contrato",
    "Contratista",
    "Integrante(s) que aporta(n) la experiencia",
    "Entidad contratante",
    "Objeto",
    "Código UNSPSC RUP",
    "Consecutivo RUP",
    "Experiencia (SMMLV)",
    "% Participación en ese contrato",
    "Cantidad acreditada Actividad No. 1",
    "Cantidad acreditada Actividad No. 2",
    "Cantidad acreditada Actividad No. 3",
  ];
  encabezadosExperiencia.forEach((texto, idx) => {
    const cell = sheet.getCell(fila, idx + 1);
    cell.value = texto;
    estiloEncabezadoColumna(cell);
  });
  fila++;

  const filaInicioExperiencia = fila;

  for (const p of participantes) {
    for (const exp of p.experiencia) {
      const row = sheet.getRow(fila);
      row.getCell(1).value = exp.numero_contrato ?? "";
      row.getCell(2).value = p.nombre;
      row.getCell(3).value = p.nombre;
      row.getCell(4).value = exp.entidad_contratante;
      row.getCell(5).value = exp.objeto;
      row.getCell(6).value = exp.codigo_unspsc ?? "";
      row.getCell(7).value = exp.consecutivo_rup ?? "";
      row.getCell(8).value = exp.valor_smmlv ?? "";
      row.getCell(9).value = exp.participacion_pct != null ? exp.participacion_pct / 100 : "";
      if (exp.participacion_pct != null) row.getCell(9).numFmt = "0.00%";
      // Columnas 10-12 (cantidad acreditada por actividad) se dejan en blanco:
      // dependen de la definición de "Actividad No. 1/2/3" de cada pliego específico
      // y deben verificarse manualmente contra las condiciones técnicas del proceso.
      fila++;
    }
  }

  if (fila === filaInicioExperiencia) {
    sheet.mergeCells(`A${fila}:L${fila}`);
    sheet.getCell(`A${fila}`).value = "Sin contratos de experiencia habilitante registrados (excluye contratos en ejecución).";
    sheet.getCell(`A${fila}`).font = { italic: true, color: { argb: "FF999999" } };
    fila++;
  }

  fila += 2;
  sheet.mergeCells(`A${fila}:N${fila}`);
  sheet.getCell(`A${fila}`).value = "CAPACIDAD FINANCIERA Y ORGANIZACIONAL";
  estiloEncabezadoSeccion(sheet.getCell(`A${fila}`));
  fila++;

  const filaEncabezadoFin = fila;
  sheet.getCell(`A${filaEncabezadoFin}`).value = "Información financiera";
  estiloEncabezadoColumna(sheet.getCell(`A${filaEncabezadoFin}`));
  participantes.forEach((p, i) => {
    const cell = sheet.getCell(filaEncabezadoFin, i + 2);
    cell.value = p.nombre;
    estiloEncabezadoColumna(cell);
  });
  fila++;

  const filasFinancieras: { etiqueta: string; obtener: (ind: IndicadorFinanciero | null) => number | string }[] = [
    { etiqueta: "Activo corriente", obtener: (ind) => ind?.activo_corriente ?? "" },
    { etiqueta: "Activo total", obtener: (ind) => ind?.activo_total ?? "" },
    { etiqueta: "Pasivo corriente", obtener: (ind) => ind?.pasivo_corriente ?? "" },
    { etiqueta: "Pasivo total", obtener: (ind) => ind?.pasivo_total ?? "" },
    { etiqueta: "Patrimonio", obtener: (ind) => ind?.patrimonio ?? "" },
    { etiqueta: "Utilidad operacional", obtener: (ind) => ind?.utilidad_operacional ?? "" },
    { etiqueta: "Gastos de intereses", obtener: (ind) => ind?.gastos_financieros ?? "" },
  ];

  for (const { etiqueta, obtener } of filasFinancieras) {
    sheet.getCell(`A${fila}`).value = etiqueta;
    sheet.getCell(`A${fila}`).font = { bold: true };
    participantes.forEach((p, i) => {
      const cell = sheet.getCell(fila, i + 2);
      const valor = obtener(p.indicador);
      cell.value = valor;
      if (typeof valor === "number") cell.numFmt = "#,##0";
    });
    fila++;
  }

  fila += 2;
  const notas = [
    "NOTAS:",
    "1. Si el contrato fue ejecutado en Consorcio o Unión Temporal, escriba en la celda CONTRATISTA el nombre de la firma contratista y de todos los integrantes con su respectiva participación.",
    "2. Las columnas de cantidad acreditada por Actividad No. 1/2/3 se generan en blanco porque dependen de la definición técnica específica de cada pliego — complételas verificando las condiciones técnicas particulares del proceso.",
    "3. Los contratos en estado 'en ejecución' no se incluyen en esta lista porque no cuentan como experiencia habilitante.",
    "4. Verifica cada dato contra el RUP en firme antes de presentar la oferta — este formulario es una ayuda de preparación generada por ApacheLegal, no un documento oficial de la EAAB.",
  ];
  for (const nota of notas) {
    sheet.mergeCells(`A${fila}:N${fila}`);
    sheet.getCell(`A${fila}`).value = nota;
    sheet.getCell(`A${fila}`).font = { size: 9, italic: true };
    sheet.getCell(`A${fila}`).alignment = { wrapText: true };
    fila++;
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
