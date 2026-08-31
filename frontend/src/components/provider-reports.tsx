"use client";

import { useState } from "react";
import { CheckCircle2, Download, Search, XCircle } from "lucide-react";
import { browserApiRequest } from "@/lib/api/client";
import type { OrdersReportDto } from "@/lib/api/contracts";
import { formatChileanDate, parseChileanDate } from "@/lib/date-format";

export function OperationsReports({
  endpoint,
  initialReport,
}: {
  endpoint: string;
  initialReport: OrdersReportDto;
}) {
  const [report, setReport] = useState(initialReport);
  const [period, setPeriod] = useState<OrdersReportDto["period"]>(initialReport.period);
  const [dateText, setDateText] = useState(() => formatChileanDate(initialReport.range.to));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadReport() {
    const selectedDate = parseChileanDate(dateText);
    if (!selectedDate) {
      setError("Ingresa una fecha válida con formato dd/mm/aaaa.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      setReport(
        await browserApiRequest<OrdersReportDto>(
          `${endpoint}?period=${period}&date=${selectedDate}`,
        ),
      );
      setDateText(formatChileanDate(selectedDate));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible generar el reporte");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    const rows = [
      ["Fecha", "Solicitadas", "Confirmadas", "Entregadas", "Canceladas", "Pan", "Té"],
      ...report.days.map((day) => [
        formatChileanDate(day.serviceDate),
        day.totals.requested,
        day.totals.confirmed,
        day.totals.fulfilled,
        day.totals.cancelled,
        day.totals.bread,
        day.totals.tea,
      ]),
    ];
    const content = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    const fileDate = formatChileanDate(report.range.to).replaceAll("/", "-");
    link.download = `reporte-colaciones-${period}-${fileDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="provider-panel-enter mt-6 space-y-5">
      <div className="provider-report-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Reportes de colaciones</p>
          <h2 className="mt-1 text-2xl font-black">Historial operacional</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Período {formatChileanDate(report.range.from)} al {formatChileanDate(report.range.to)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs font-extrabold text-[var(--muted)]">
            Período
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as OrdersReportDto["period"])}
              className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-bold text-[var(--foreground)]"
            >
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-extrabold text-[var(--muted)]">
            Fecha de referencia
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              placeholder="dd/mm/aaaa"
              value={dateText}
              onChange={(event) => setDateText(event.target.value)}
              aria-invalid={Boolean(error && !parseChileanDate(dateText))}
              className="min-h-11 w-36 rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)]"
            />
          </label>
          <button
            type="button"
            onClick={loadReport}
            disabled={loading}
            className="provider-action inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 font-extrabold text-white"
          >
            <Search size={17} /> {loading ? "Consultando…" : "Consultar"}
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="provider-action inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--herb)] px-4 font-extrabold text-white"
          >
            <Download size={17} /> CSV
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="provider-feedback-enter rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div key={report.generatedAt} className="provider-report-results space-y-5">
        <div className="provider-stagger-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Solicitadas" value={report.totals.requested} />
          <Metric label="Confirmadas" value={report.totals.confirmed} strong />
          <Metric label="Entregadas" value={report.totals.fulfilled} />
          <Metric label="Canceladas" value={report.totals.cancelled} />
        </div>
        <div className="provider-stagger-grid grid gap-4 sm:grid-cols-3">
          <Metric label="Pan" value={report.totals.bread} />
          <Metric label="Té" value={report.totals.tea} />
          <Metric label="Capacitaciones" value={report.totals.byKind.training} />
        </div>
        <div className="provider-table-enter card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3">Fecha</th>
              <th className="px-4 py-3 text-right">Solicitadas</th>
              <th className="px-4 py-3 text-right">Confirmadas</th>
              <th className="px-4 py-3 text-right">Entregadas</th>
              <th className="px-4 py-3 text-right">Canceladas</th>
              <th className="px-4 py-3 text-right">Pan</th>
              <th className="px-5 py-3 text-right">Té</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {report.days.map((day) => (
              <tr key={day.serviceDayId}>
                <td className="px-5 py-4 font-bold">{formatChileanDate(day.serviceDate)}</td>
                <td className="px-4 py-4 text-right">{day.totals.requested}</td>
                <td className="px-4 py-4 text-right">{day.totals.confirmed}</td>
                <td className="px-4 py-4 text-right">{day.totals.fulfilled}</td>
                <td className="px-4 py-4 text-right">{day.totals.cancelled}</td>
                <td className="px-4 py-4 text-right">{day.totals.bread}</td>
                <td className="px-5 py-4 text-right">{day.totals.tea}</td>
              </tr>
            ))}
            {report.days.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[var(--muted)]">
                  No hay registros en el período.
                </td>
              </tr>
            ) : null}
          </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  const Icon = strong ? CheckCircle2 : XCircle;
  return (
    <article className={`provider-card-motion card p-5 ${strong ? "card-strong" : ""}`}>
      <Icon size={19} />
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className={`text-sm font-bold ${strong ? "text-white/80" : "text-[var(--muted)]"}`}>
        {label}
      </p>
    </article>
  );
}
