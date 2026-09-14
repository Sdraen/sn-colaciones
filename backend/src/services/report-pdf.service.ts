import pdfMake, { type Content } from "pdfmake";
import type { NominalOrdersReport, NominalReportRow } from "./report.service.js";

type TDocumentDefinitions = Parameters<typeof pdfMake.createPdf>[0];
type TableContent = Extract<Content, { table: unknown }>;
type TableCell = TableContent["table"]["body"][number][number];

const BRAND = "#DF4929";
const INK = "#3B281F";
const MUTED = "#7B685E";
const LINE = "#EBCBA5";
const SURFACE = "#FFF8EE";
const GREEN = "#3D7F4B";

pdfMake.setFonts({
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
});

export async function createNominalOrdersPdf(report: NominalOrdersReport) {
  const body: TableCell[][] = [
    [
      tableHeader("Fecha"),
      tableHeader("Trabajador o beneficiario"),
      tableHeader("Código"),
      tableHeader("Tipo"),
      tableHeader("Preparación"),
      tableHeader("Acomp."),
      tableHeader("Pan / Té"),
      tableHeader("Cant."),
      tableHeader("Estado"),
    ],
    ...report.rows.map(reportRow),
  ];

  if (report.rows.length === 0) {
    body.push([
      {
        text: "No existen solicitudes para el período seleccionado.",
        colSpan: 9,
        alignment: "center",
        color: MUTED,
        margin: [0, 16],
      },
      {}, {}, {}, {}, {}, {}, {}, {},
    ]);
  }

  const definition: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 32, 28, 38],
    info: {
      title: `Reporte nominal de colaciones ${report.range.from} a ${report.range.to}`,
      subject: "Detalle nominal de solicitudes de colaciones",
      author: "SN Colaciones",
      creationDate: new Date(report.generatedAt),
    },
    defaultStyle: { font: "Helvetica", fontSize: 8, color: INK },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: "SN Colaciones · Documento de uso interno", color: MUTED },
        {
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: "right",
          color: MUTED,
        },
      ],
      margin: [28, 12, 28, 0],
      fontSize: 7,
    }),
    content: [
      {
        columns: [
          {
            stack: [
              { text: "SN COLACIONES", color: BRAND, bold: true, fontSize: 9 },
              { text: "Reporte nominal de colaciones", bold: true, fontSize: 21, margin: [0, 4, 0, 0] },
              {
                text: `${periodLabel(report.period)} · ${formatDate(report.range.from)} al ${formatDate(report.range.to)}`,
                color: MUTED,
                fontSize: 9,
                margin: [0, 5, 0, 0],
              },
            ],
          },
          {
            width: 185,
            stack: [
              { text: "Generado", color: MUTED, fontSize: 7, bold: true },
              { text: formatDateTime(report.generatedAt), bold: true, margin: [0, 3, 0, 0] },
              { text: "Incluye solicitudes confirmadas, entregadas y canceladas.", color: MUTED, fontSize: 7, margin: [0, 5, 0, 0] },
            ],
            alignment: "right",
          },
        ],
        margin: [0, 0, 0, 14],
      },
      {
        table: {
          widths: ["*", "*", "*", "*"],
          body: [
            [
              metric("Solicitadas", report.totals.requested),
              metric("Confirmadas", report.totals.confirmed, GREEN),
              metric("Entregadas", report.totals.fulfilled),
              metric("Canceladas", report.totals.cancelled, "#B83A34"),
            ],
          ],
        },
        layout: {
          hLineColor: () => LINE,
          vLineColor: () => LINE,
          paddingLeft: () => 9,
          paddingRight: () => 9,
          paddingTop: () => 7,
          paddingBottom: () => 7,
        },
        margin: [0, 0, 0, 14],
      },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [47, 116, 43, 50, 150, 48, 45, 27, 48],
          body,
        },
        layout: {
          fillColor: (rowIndex: number) => rowIndex === 0 ? BRAND : rowIndex % 2 === 0 ? SURFACE : null,
          hLineColor: () => LINE,
          vLineColor: () => LINE,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingLeft: () => 5,
          paddingRight: () => 5,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      },
      {
        text: "Las filas de capacitación representan grupos; las colaciones extra muestran el beneficiario informado por Securitas.",
        color: MUTED,
        fontSize: 7,
        italics: true,
        margin: [0, 9, 0, 0],
      },
    ],
  };

  return pdfMake.createPdf(definition).getBuffer();
}

function tableHeader(text: string): TableCell {
  return { text, color: "#FFFFFF", bold: true, fontSize: 7 };
}

function reportRow(row: NominalReportRow): TableCell[] {
  return [
    { text: formatDate(row.serviceDate), noWrap: true },
    { text: row.beneficiaryName, bold: row.kind === "regular" },
    { text: row.employeeCode || "—" },
    { text: kindLabel(row.kind) },
    { stack: [{ text: row.menuLabel, bold: true }, { text: row.preparation, color: MUTED, margin: [0, 2, 0, 0] }] },
    { text: sideLabel(row.side) },
    { text: complementLabel(row) },
    { text: String(row.quantity), alignment: "right", bold: true },
    { text: statusLabel(row), color: statusColor(row), bold: true },
  ];
}

function metric(label: string, value: number, color = INK): Content {
  return {
    stack: [
      { text: String(value), fontSize: 16, bold: true, color },
      { text: label, fontSize: 7, color: MUTED, margin: [0, 2, 0, 0] },
    ],
  };
}

function periodLabel(period: NominalOrdersReport["period"]) {
  return period === "daily" ? "Reporte diario" : period === "weekly" ? "Reporte semanal" : "Reporte mensual";
}

function kindLabel(kind: NominalReportRow["kind"]) {
  if (kind === "regular") return "Trabajador";
  if (kind === "training") return "Capacitación";
  if (kind === "exceptional") return "Excepcional";
  return "Extra";
}

function sideLabel(side: NominalReportRow["side"]) {
  if (side === "ensalada") return "Ensalada";
  if (side === "fruta") return "Fruta";
  if (side === "postre") return "Postre";
  return "Ninguno";
}

function complementLabel(row: NominalReportRow) {
  if (row.bread && row.tea) return "Pan y té";
  if (row.bread) return "Pan";
  if (row.tea) return "Té";
  return "Ninguno";
}

function statusLabel(row: NominalReportRow) {
  if (row.status === "cancelled") return "Cancelada";
  return row.fulfilled ? "Entregada" : "Confirmada";
}

function statusColor(row: NominalReportRow) {
  if (row.status === "cancelled") return "#B83A34";
  return row.fulfilled ? GREEN : INK;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santiago",
  }).format(new Date(value));
}
