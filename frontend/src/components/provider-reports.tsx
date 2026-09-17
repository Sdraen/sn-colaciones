"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, Download, FileText, RefreshCw, Search, XCircle } from "lucide-react";
import { browserApiDownload, browserApiRequest } from "@/lib/api/client";
import type { OrdersReportDto } from "@/lib/api/contracts";
import { DatePickerField } from "@/components/date-picker-field";
import { FormSelect } from "@/components/ui/form-select";
import { formatChileanDate } from "@/lib/date-format";
import { formatRefreshTime, useAutoRefresh } from "@/hooks/use-auto-refresh";

export function OperationsReports({
  endpoint,
  initialReport,
}: {
  endpoint: string;
  initialReport: OrdersReportDto;
}) {
  const [report, setReport] = useState(initialReport);
  const [period, setPeriod] = useState<OrdersReportDto["period"]>(initialReport.period);
  const [selectedDate, setSelectedDate] = useState(initialReport.range.to);
  const [validationError, setValidationError] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [search, setSearch] = useState("");
  const [searchScope, setSearchScope] = useState<"all" | "worker" | "menu" | "kind">("all");
  const supportsNominalPdf = [
    "/api/v1/provider/reports",
    "/api/v1/company/reports",
  ].includes(endpoint);

  const refreshReport = useCallback(async () => {
    if (!selectedDate) return;
    setReport(
      await browserApiRequest<OrdersReportDto>(
        `${endpoint}?period=${period}&date=${selectedDate}`,
      ),
    );
  }, [endpoint, period, selectedDate]);
  const { lastUpdatedAt, refreshError, refreshing, refreshNow } = useAutoRefresh(
    refreshReport,
    { enabled: Boolean(selectedDate) },
  );
  const error = validationError || refreshError;
  const visibleNominalRows = useMemo(() => {
    const query = normalizeSearch(search);
    return report.nominalRows.filter((row) => {
      if (row.status !== "confirmed") return false;
      if (!query) return true;
      const values = {
        worker: `${row.beneficiaryName} ${row.employeeCode}`,
        menu: `${row.menuLabel} ${row.preparation}`,
        kind: kindLabel(row.kind),
      };
      const haystack = searchScope === "all"
        ? Object.values(values).join(" ")
        : values[searchScope];
      return normalizeSearch(haystack).includes(query);
    });
  }, [report.nominalRows, search, searchScope]);

  async function loadReport() {
    if (!selectedDate) {
      setValidationError("Ingresa una fecha válida con formato dd/mm/aaaa.");
      return;
    }

    setValidationError("");
    await refreshNow();
  }

  function downloadCsv() {
    const rows = [
      ["Fecha", "Categoría", "Preparación", "Reservas anticipadas", "Conteo final", "Ensalada", "Fruta", "Pan", "Té"],
      ...report.days.flatMap((day) => day.menuBreakdown.map((item) => [
        formatChileanDate(day.serviceDate),
        item.label,
        item.description,
        item.regular,
        item.confirmed,
        item.salad,
        item.fruit,
        item.bread,
        item.tea,
      ])),
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

  async function downloadPdf() {
    if (!selectedDate) {
      setValidationError("Ingresa una fecha válida con formato dd/mm/aaaa.");
      return;
    }

    setValidationError("");
    setDownloadingPdf(true);
    try {
      const { blob, fileName } = await browserApiDownload(
        `${endpoint}/pdf?period=${period}&date=${selectedDate}`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName ?? `reporte-nominal-colaciones-${period}-${selectedDate}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (downloadError) {
      setValidationError(
        downloadError instanceof Error
          ? downloadError.message
          : "No fue posible descargar el reporte PDF.",
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <section className="provider-panel-enter mt-6 space-y-5">
      <div className="provider-report-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Reportes de colaciones</p>
          <h2 className="mt-1 text-xl font-black sm:text-2xl">Historial operacional</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Período {formatChileanDate(report.range.from)} al {formatChileanDate(report.range.to)}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 items-end gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <label className="grid gap-1 text-xs font-extrabold text-[var(--muted)]">
            Período
            <FormSelect
              value={period}
              onValueChange={(value) => setPeriod(value as OrdersReportDto["period"])}
              ariaLabel="Período del reporte"
              options={[
                { value: "daily", label: "Diario" },
                { value: "weekly", label: "Semanal" },
                { value: "monthly", label: "Mensual" },
              ]}
              className="min-h-11 text-sm font-bold"
            />
          </label>
          <DatePickerField
            label="Fecha de referencia"
            value={selectedDate}
            onChange={(value) => {
              setSelectedDate(value);
              setValidationError("");
            }}
            inputClassName="sm:w-40"
          />
          <button
            type="button"
            onClick={() => void loadReport()}
            disabled={refreshing}
            className="provider-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-3 font-extrabold text-white sm:px-4"
          >
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Actualizando…" : "Actualizar"}
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="provider-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--herb)] px-3 font-extrabold text-white sm:px-4"
          >
            <Download size={17} /> CSV
          </button>
          {supportsNominalPdf ? (
            <button
              type="button"
              onClick={() => void downloadPdf()}
              disabled={downloadingPdf}
              className="provider-action col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 font-extrabold text-[var(--ink)] disabled:cursor-wait disabled:opacity-60 sm:col-span-1 sm:px-4"
            >
              <FileText size={17} className={downloadingPdf ? "animate-pulse" : ""} />
              {downloadingPdf ? "Generando…" : "PDF completo"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="provider-feedback-enter rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <p role="status" className="text-xs font-bold text-[var(--muted)]">
        {formatRefreshTime(lastUpdatedAt)}
      </p>

      <div key={report.generatedAt} className="provider-report-results space-y-5">
        <div className="provider-stagger-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Solicitadas" value={report.totals.requested} />
          <Metric label="Confirmadas" value={report.totals.confirmed} strong />
          <Metric label="Entregadas" value={report.totals.fulfilled} />
          <Metric label="Canceladas" value={report.totals.cancelled} />
        </div>
        <div className="provider-stagger-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Ensaladas" value={report.totals.sides.salad} />
          <Metric label="Frutas" value={report.totals.sides.fruit} />
          <Metric label="Pan" value={report.totals.bread} />
          <Metric label="Té" value={report.totals.tea} />
        </div>
        <section className="card overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-4">
            <h3 className="font-black">Disponibles y conteo final por preparación</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              “Reservas anticipadas” considera trabajadores registrados antes del cierre de las 22:00. “Conteo final” suma todas las colaciones confirmadas.
            </p>
          </div>
        <div className="provider-table-enter mobile-scroll-tabs card max-w-full overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3">Fecha</th>
              <th className="px-4 py-3">Plato</th>
              <th className="px-4 py-3 text-right">Anticipadas</th>
              <th className="px-4 py-3 text-right">Final</th>
              <th className="px-4 py-3 text-right">Ensalada</th>
              <th className="px-4 py-3 text-right">Fruta</th>
              <th className="px-4 py-3 text-right">Pan</th>
              <th className="px-5 py-3 text-right">Té</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {report.days.flatMap((day) => day.menuBreakdown.map((item) => (
              <tr key={`${day.serviceDayId}-${item.menuOptionId}`}>
                <td className="px-5 py-4 font-bold">{formatChileanDate(day.serviceDate)}</td>
                <td className="px-4 py-4"><strong>{item.label}</strong><span className="block text-xs text-[var(--muted)]">{item.description}</span></td>
                <td className="px-4 py-4 text-right">{item.regular}</td>
                <td className="px-4 py-4 text-right font-black">{item.confirmed}</td>
                <td className="px-4 py-4 text-right">{item.salad}</td>
                <td className="px-4 py-4 text-right">{item.fruit}</td>
                <td className="px-4 py-4 text-right">{item.bread}</td>
                <td className="px-5 py-4 text-right">{item.tea}</td>
              </tr>
            )))}
            {report.days.every((day) => day.menuBreakdown.length === 0) ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-[var(--muted)]">
                  No hay registros en el período.
                </td>
              </tr>
            ) : null}
          </tbody>
          </table>
        </div>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-[var(--line)] p-5">
            <h3 className="font-black">Listado de trabajadores y colaciones</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Busca por nombre, categoría o preparación. Se muestran sólo reservas confirmadas.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)]">
              <FormSelect
                value={searchScope}
                onValueChange={(value) => setSearchScope(value as typeof searchScope)}
                ariaLabel="Categoría de búsqueda"
                options={[
                  { value: "all", label: "Todo" },
                  { value: "worker", label: "Funcionario" },
                  { value: "menu", label: "Comida" },
                  { value: "kind", label: "Categoría" },
                ]}
                className="min-h-11 text-sm font-bold"
              />
              <label className="relative block">
                <span className="sr-only">Buscar en el reporte</span>
                <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar nombre, plato o categoría"
                  className="form-control min-h-11 pl-10 pr-3 text-sm"
                />
              </label>
            </div>
          </div>
          <div className="mobile-scroll-tabs max-w-full overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
                <tr><th className="p-3">Fecha</th><th className="p-3">Funcionario / grupo</th><th className="p-3">Categoría</th><th className="p-3">Plato</th><th className="p-3">Acompañamiento</th><th className="p-3">Pan</th><th className="p-3">Té</th><th className="p-3 text-right">Cantidad</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {visibleNominalRows.map((row) => (
                  <tr key={row.orderId}>
                    <td className="p-3 font-bold">{formatChileanDate(row.serviceDate)}</td>
                    <td className="p-3"><strong>{row.beneficiaryName}</strong>{row.employeeCode ? <span className="block text-xs text-[var(--muted)]">{row.employeeCode}</span> : null}</td>
                    <td className="p-3">{kindLabel(row.kind)}</td>
                    <td className="p-3"><strong>{row.menuLabel}</strong><span className="block text-xs text-[var(--muted)]">{row.preparation}</span></td>
                    <td className="p-3">{sideLabel(row.side)}</td>
                    <td className="p-3">{row.bread ? "Sí" : "No"}</td>
                    <td className="p-3">{row.tea ? "Sí" : "No"}</td>
                    <td className="p-3 text-right font-black">{row.quantity}</td>
                  </tr>
                ))}
                {visibleNominalRows.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-[var(--muted)]">No hay resultados para esta búsqueda.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL").trim();
}

function kindLabel(kind: "regular" | "training" | "extra" | "exceptional") {
  if (kind === "regular") return "Trabajador";
  if (kind === "training") return "Capacitación";
  return kind === "exceptional" ? "Extra excepcional" : "Extra";
}

function sideLabel(side: string) {
  if (side === "ensalada") return "Ensalada";
  if (side === "fruta") return "Fruta";
  if (side === "postre") return "Postre (histórico)";
  return "Sin acompañamiento";
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
