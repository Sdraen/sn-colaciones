"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  RefreshCw,
  Search,
  Utensils,
  UsersRound,
  XCircle,
} from "lucide-react";
import { browserApiDownload, browserApiRequest } from "@/lib/api/client";
import type { OrdersReportDto } from "@/lib/api/contracts";
import { DatePickerField } from "@/components/date-picker-field";
import { FormSelect } from "@/components/ui/form-select";
import { formatChileanDate } from "@/lib/date-format";
import { formatRefreshTime, useAutoRefresh } from "@/hooks/use-auto-refresh";

type ReportSection = "summary" | "preparations" | "nominal";
type SearchScope = "all" | "worker" | "menu" | "kind";

const NOMINAL_PAGE_SIZE = 20;
const REPORT_SECTIONS = [
  { id: "summary" as const, label: "Resumen", icon: BarChart3 },
  { id: "preparations" as const, label: "Preparaciones", icon: Utensils },
  { id: "nominal" as const, label: "Nómina", icon: UsersRound },
];

export function OperationsReports({
  endpoint,
  initialReport,
  sectioned = false,
}: {
  endpoint: string;
  initialReport: OrdersReportDto;
  sectioned?: boolean;
}) {
  const [report, setReport] = useState(initialReport);
  const [period, setPeriod] = useState<OrdersReportDto["period"]>(initialReport.period);
  const [selectedDate, setSelectedDate] = useState(initialReport.range.to);
  const [validationError, setValidationError] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeSection, setActiveSection] = useState<ReportSection>("summary");
  const [search, setSearch] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [dayFilter, setDayFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [menuFilter, setMenuFilter] = useState("all");
  const [nominalPage, setNominalPage] = useState(1);
  const supportsNominalPdf = [
    "/api/v1/provider/reports",
    "/api/v1/company/reports",
  ].includes(endpoint);

  const refreshReport = useCallback(async () => {
    if (!selectedDate) return;
    const nextReport = await browserApiRequest<OrdersReportDto>(
      `${endpoint}?period=${period}&date=${selectedDate}`,
    );
    setReport(nextReport);
    setDayFilter((current) =>
      current === "all" || nextReport.days.some((day) => day.serviceDate === current)
        ? current
        : "all",
    );
    setMenuFilter((current) =>
      current === "all" || nextReport.nominalRows.some((row) => row.menuLabel === current)
        ? current
        : "all",
    );
  }, [endpoint, period, selectedDate]);
  const { lastUpdatedAt, refreshError, refreshing, refreshNow } = useAutoRefresh(
    refreshReport,
    { enabled: Boolean(selectedDate) },
  );
  const error = validationError || refreshError;
  const menuFilterOptions = useMemo(() => {
    const menus = new Map<string, string>();
    for (const row of report.nominalRows) {
      menus.set(row.menuLabel, row.menuLabel);
    }
    return [
      { value: "all", label: "Todas las preparaciones" },
      ...[...menus.values()]
        .toSorted((a, b) => a.localeCompare(b, "es-CL"))
        .map((label) => ({ value: label, label })),
    ];
  }, [report.nominalRows]);
  const visibleNominalRows = useMemo(() => {
    const query = normalizeSearch(search);
    return report.nominalRows.filter((row) => {
      if (row.status !== "confirmed") return false;
      if (dayFilter !== "all" && row.serviceDate !== dayFilter) return false;
      if (kindFilter === "extra" && !["extra", "exceptional"].includes(row.kind)) return false;
      if (kindFilter !== "all" && kindFilter !== "extra" && row.kind !== kindFilter) return false;
      if (menuFilter !== "all" && row.menuLabel !== menuFilter) return false;
      if (!query) return true;
      return normalizeSearch(`${row.beneficiaryName} ${row.employeeCode}`).includes(query);
    });
  }, [dayFilter, kindFilter, menuFilter, report.nominalRows, search]);
  const legacyNominalRows = useMemo(() => {
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
  const nominalPageCount = Math.max(1, Math.ceil(visibleNominalRows.length / NOMINAL_PAGE_SIZE));
  const currentNominalPage = Math.min(nominalPage, nominalPageCount);
  const paginatedNominalRows = visibleNominalRows.slice(
    (currentNominalPage - 1) * NOMINAL_PAGE_SIZE,
    currentNominalPage * NOMINAL_PAGE_SIZE,
  );

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

      {sectioned ? (
        <div
          role="tablist"
          aria-label="Secciones del reporte"
          className="grid grid-cols-3 gap-1 rounded-2xl bg-[var(--surface-muted)] p-1.5"
        >
          {REPORT_SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeSection === id}
              aria-controls={`provider-report-${id}`}
              id={`provider-report-tab-${id}`}
              onClick={() => setActiveSection(id)}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-sm font-extrabold transition sm:px-4 ${
                activeSection === id
                  ? "bg-white text-[var(--brand)] shadow-sm"
                  : "text-[var(--muted)] hover:bg-white/60"
              }`}
            >
              <Icon size={17} aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label === "Preparaciones" ? "Platos" : label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {sectioned ? (
        <div key={report.generatedAt} className="provider-report-results space-y-5">
          {activeSection === "summary" ? (
            <div id="provider-report-summary" role="tabpanel" aria-labelledby="provider-report-tab-summary">
              <ProviderSummary report={report} />
            </div>
          ) : null}
          {activeSection === "preparations" ? (
            <div id="provider-report-preparations" role="tabpanel" aria-labelledby="provider-report-tab-preparations">
              <GroupedPreparations report={report} period={period} />
            </div>
          ) : null}
          {activeSection === "nominal" ? (
            <div id="provider-report-nominal" role="tabpanel" aria-labelledby="provider-report-tab-nominal">
              <ProviderNominalReport
                report={report}
                rows={paginatedNominalRows}
                filteredCount={visibleNominalRows.length}
                search={search}
                dayFilter={dayFilter}
                kindFilter={kindFilter}
                menuFilter={menuFilter}
                menuFilterOptions={menuFilterOptions}
                currentPage={currentNominalPage}
                pageCount={nominalPageCount}
                onSearchChange={(value) => {
                  setSearch(value);
                  setNominalPage(1);
                }}
                onDayFilterChange={(value) => {
                  setDayFilter(value);
                  setNominalPage(1);
                }}
                onKindFilterChange={(value) => {
                  setKindFilter(value);
                  setNominalPage(1);
                }}
                onMenuFilterChange={(value) => {
                  setMenuFilter(value);
                  setNominalPage(1);
                }}
                onPageChange={setNominalPage}
              />
            </div>
          ) : null}
        </div>
      ) : (
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
                {legacyNominalRows.map((row) => (
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
                {legacyNominalRows.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-[var(--muted)]">No hay resultados para esta búsqueda.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      )}
    </section>
  );
}

function ProviderSummary({ report }: { report: OrdersReportDto }) {
  return (
    <div className="space-y-5">
      <div className="provider-stagger-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Solicitadas" value={report.totals.requested} />
        <Metric label="Confirmadas" value={report.totals.confirmed} strong />
        <Metric label="Entregadas" value={report.totals.fulfilled} />
        <Metric label="Canceladas" value={report.totals.cancelled} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="Tipo de colación"
          description="Distribución de las reservas confirmadas."
          items={[
            { label: "Trabajadores", value: report.totals.byKind.regular },
            { label: "Capacitaciones", value: report.totals.byKind.training },
            {
              label: "Extras",
              value: (report.totals.byKind.extra ?? 0) + (report.totals.byKind.exceptional ?? 0),
            },
          ]}
        />
        <BreakdownCard
          title="Acompañamientos y complementos"
          description="Totales necesarios para preparar el período."
          items={[
            { label: "Ensaladas", value: report.totals.sides.salad },
            { label: "Frutas", value: report.totals.sides.fruit },
            { label: "Postres", value: report.totals.sides.dessert },
            { label: "Pan", value: report.totals.bread },
            { label: "Té", value: report.totals.tea },
          ]}
        />
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ label: string; value: number }>;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--line)] px-5 py-4">
        <h3 className="font-black">{title}</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
      </div>
      <dl className="divide-y divide-[var(--line)] px-5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 py-3">
            <dt className="text-sm font-bold text-[var(--muted)]">{item.label}</dt>
            <dd className="text-lg font-black">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function GroupedPreparations({
  report,
  period,
}: {
  report: OrdersReportDto;
  period: OrdersReportDto["period"];
}) {
  const hasRecords = report.days.some((day) => day.menuBreakdown.length > 0);
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-black">Conteo por día y preparación</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Abre un día para revisar sus platos, acompañamientos y complementos.
        </p>
      </div>
      {report.days.map((day) => {
        const total = day.menuBreakdown.reduce((sum, item) => sum + item.confirmed, 0);
        return (
          <details
            key={day.serviceDayId}
            className="group card overflow-hidden"
            open={period === "daily" ? true : undefined}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-5">
              <span>
                <strong className="block">{formatChileanDate(day.serviceDate)}</strong>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                  {day.menuBreakdown.length} {day.menuBreakdown.length === 1 ? "preparación" : "preparaciones"}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-black">
                  {total} colaciones
                </span>
                <ChevronRight size={18} className="transition group-open:rotate-90" aria-hidden="true" />
              </span>
            </summary>
            <div className="border-t border-[var(--line)]">
              {day.menuBreakdown.length > 0 ? (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
                        <tr>
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
                        {day.menuBreakdown.map((item) => (
                          <tr key={item.menuOptionId}>
                            <td className="px-4 py-4">
                              <strong>{item.label}</strong>
                              <span className="block text-xs text-[var(--muted)]">{item.description}</span>
                            </td>
                            <td className="px-4 py-4 text-right">{item.regular}</td>
                            <td className="px-4 py-4 text-right font-black">{item.confirmed}</td>
                            <td className="px-4 py-4 text-right">{item.salad}</td>
                            <td className="px-4 py-4 text-right">{item.fruit}</td>
                            <td className="px-4 py-4 text-right">{item.bread}</td>
                            <td className="px-5 py-4 text-right">{item.tea}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="divide-y divide-[var(--line)] md:hidden">
                    {day.menuBreakdown.map((item) => (
                      <article key={item.menuOptionId} className="p-4">
                        <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--brand)]">
                          {item.label}
                        </p>
                        <h4 className="mt-1 font-black">{item.description}</h4>
                        <dl className="mt-3 grid grid-cols-3 gap-2">
                          <CompactValue label="Anticipadas" value={item.regular} />
                          <CompactValue label="Final" value={item.confirmed} strong />
                          <CompactValue label="Ensalada" value={item.salad} />
                          <CompactValue label="Fruta" value={item.fruit} />
                          <CompactValue label="Pan" value={item.bread} />
                          <CompactValue label="Té" value={item.tea} />
                        </dl>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <p className="p-5 text-sm text-[var(--muted)]">Sin colaciones registradas para este día.</p>
              )}
            </div>
          </details>
        );
      })}
      {!hasRecords ? (
        <div className="card p-8 text-center text-[var(--muted)]">
          No hay registros en el período.
        </div>
      ) : null}
    </section>
  );
}

function CompactValue({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`rounded-xl p-2.5 ${strong ? "bg-[var(--brand-soft)]" : "bg-[var(--surface-muted)]"}`}>
      <dt className="text-[10px] font-bold text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-lg font-black">{value}</dd>
    </div>
  );
}

function ProviderNominalReport({
  report,
  rows,
  filteredCount,
  search,
  dayFilter,
  kindFilter,
  menuFilter,
  menuFilterOptions,
  currentPage,
  pageCount,
  onSearchChange,
  onDayFilterChange,
  onKindFilterChange,
  onMenuFilterChange,
  onPageChange,
}: {
  report: OrdersReportDto;
  rows: OrdersReportDto["nominalRows"];
  filteredCount: number;
  search: string;
  dayFilter: string;
  kindFilter: string;
  menuFilter: string;
  menuFilterOptions: Array<{ value: string; label: string }>;
  currentPage: number;
  pageCount: number;
  onSearchChange: (value: string) => void;
  onDayFilterChange: (value: string) => void;
  onKindFilterChange: (value: string) => void;
  onMenuFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--line)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-black">Nómina de solicitudes</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Sólo reservas confirmadas. Filtra antes de revisar o descargar el reporte completo.
            </p>
          </div>
          <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-extrabold">
            {filteredCount} resultados
          </span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative block md:col-span-2 xl:col-span-1">
            <span className="sr-only">Buscar trabajador</span>
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Nombre o código"
              className="form-control min-h-11 pl-10 pr-3 text-sm"
            />
          </label>
          <FormSelect
            value={dayFilter}
            onValueChange={onDayFilterChange}
            ariaLabel="Filtrar por día"
            options={[
              { value: "all", label: "Todos los días" },
              ...report.days.map((day) => ({
                value: day.serviceDate,
                label: formatChileanDate(day.serviceDate),
              })),
            ]}
            className="min-h-11 text-sm font-bold"
          />
          <FormSelect
            value={kindFilter}
            onValueChange={onKindFilterChange}
            ariaLabel="Filtrar por tipo de colación"
            options={[
              { value: "all", label: "Todos los tipos" },
              { value: "regular", label: "Trabajadores" },
              { value: "training", label: "Capacitaciones" },
              { value: "extra", label: "Extras" },
            ]}
            className="min-h-11 text-sm font-bold"
          />
          <FormSelect
            value={menuFilter}
            onValueChange={onMenuFilterChange}
            ariaLabel="Filtrar por preparación"
            options={menuFilterOptions}
            className="min-h-11 text-sm font-bold"
          />
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Funcionario / grupo</th>
              <th className="p-3">Categoría</th>
              <th className="p-3">Plato</th>
              <th className="p-3">Acompañamiento</th>
              <th className="p-3">Pan</th>
              <th className="p-3">Té</th>
              <th className="p-3 text-right">Cantidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.map((row) => (
              <tr key={row.orderId}>
                <td className="p-3 font-bold">{formatChileanDate(row.serviceDate)}</td>
                <td className="p-3">
                  <strong>{row.beneficiaryName}</strong>
                  {row.employeeCode ? <span className="block text-xs text-[var(--muted)]">{row.employeeCode}</span> : null}
                </td>
                <td className="p-3">{kindLabel(row.kind)}</td>
                <td className="p-3">
                  <strong>{row.menuLabel}</strong>
                  <span className="block text-xs text-[var(--muted)]">{row.preparation}</span>
                </td>
                <td className="p-3">{sideLabel(row.side)}</td>
                <td className="p-3">{row.bread ? "Sí" : "No"}</td>
                <td className="p-3">{row.tea ? "Sí" : "No"}</td>
                <td className="p-3 text-right font-black">{row.quantity}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-[var(--muted)]">No hay resultados para estos filtros.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-[var(--line)] md:hidden">
        {rows.map((row) => (
          <article key={row.orderId} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-black">{row.beneficiaryName}</h4>
                <p className="text-xs text-[var(--muted)]">
                  {row.employeeCode || "Sin código"} · {formatChileanDate(row.serviceDate)}
                </p>
              </div>
              <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-extrabold">
                x{row.quantity}
              </span>
            </div>
            <div className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3">
              <p className="text-xs font-extrabold uppercase text-[var(--brand)]">{kindLabel(row.kind)}</p>
              <p className="mt-1 font-bold">{row.menuLabel}</p>
              <p className="text-xs text-[var(--muted)]">{row.preparation}</p>
            </div>
            <p className="mt-3 text-xs font-bold text-[var(--muted)]">
              {sideLabel(row.side)} · {row.bread ? "Con pan" : "Sin pan"} · {row.tea ? "Con té" : "Sin té"}
            </p>
          </article>
        ))}
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--muted)]">No hay resultados para estos filtros.</p>
        ) : null}
      </div>

      {filteredCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 sm:px-5">
          <p className="text-xs font-bold text-[var(--muted)]">Página {currentPage} de {pageCount}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === pageCount}
              className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : null}
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
