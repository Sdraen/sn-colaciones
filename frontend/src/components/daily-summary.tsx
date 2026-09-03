"use client";

import { useCallback, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, PackageCheck, Printer, RefreshCw, UsersRound } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { browserApiRequest } from "@/lib/api/client";
import type { DailySummaryDto } from "@/lib/api/contracts";
import { DeliveryProgress } from "@/components/delivery-progress";
import { formatRefreshTime, useAutoRefresh } from "@/hooks/use-auto-refresh";

export function DailySummary({
  initialSummary,
  viewerRole,
}: {
  initialSummary: DailySummaryDto | null;
  viewerRole: "provider_admin" | "company_admin" | "delivery";
}) {
  const printRef = useRef<HTMLElement>(null);
  const [summary, setSummary] = useState(initialSummary);
  const [date, setDate] = useState(initialSummary?.serviceDate ?? chileToday());
  const printSummary = useReactToPrint({
    contentRef: printRef,
    documentTitle: summary
      ? `resumen-colaciones-${summary.serviceDate}`
      : "resumen-colaciones",
    pageStyle: printPageStyle,
  });

  const refreshSummary = useCallback(async () => {
    setSummary(
      await browserApiRequest<DailySummaryDto>(`/api/v1/summaries/daily?date=${date}`),
    );
  }, [date]);
  const { lastUpdatedAt, refreshError, refreshing, refreshNow } = useAutoRefresh(
    refreshSummary,
  );

  return (
    <section ref={printRef} className="daily-summary-print provider-panel-enter space-y-5" aria-labelledby="daily-summary-title">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="eyebrow">Producción y despacho</p>
          <h2 id="daily-summary-title" className="mt-1 text-xl font-black sm:text-2xl">Resumen completo del día</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Totales en vivo, capacitaciones y detalle nominal para preparar y entregar.</p>
        </div>
        <div className="daily-summary-controls grid w-full grid-cols-2 items-end gap-2 print:hidden sm:flex sm:w-auto sm:flex-wrap">
          <label className="col-span-2 grid gap-1 text-xs font-extrabold text-[var(--muted)] sm:col-span-1">
            Fecha
            <input className="company-input min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)]" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <button type="button" onClick={() => void refreshNow()} disabled={refreshing} className="company-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-3 text-sm font-extrabold text-white disabled:opacity-50 sm:px-4">
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Actualizando…" : "Actualizar"}
          </button>
          <button type="button" onClick={() => printSummary()} disabled={!summary} className="company-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50 sm:px-4">
            <Printer size={17} /> Imprimir
          </button>
        </div>
      </div>

      <p role="status" className="print:hidden text-xs font-bold text-[var(--muted)]">
        {formatRefreshTime(lastUpdatedAt)}
      </p>
      {refreshError ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">{refreshError}</p> : null}
      {!summary ? <div className="card p-8 text-center text-[var(--muted)]">No hay un día de servicio disponible para mostrar.</div> : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 font-extrabold ${summary.state === "final" ? "bg-[var(--herb-soft)] text-[var(--herb-strong)]" : "bg-[var(--accent-soft)] text-[var(--warning)]"}`}>
              {summary.state === "final" ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
              {summary.state === "final" ? "Resumen final" : "En vivo hasta las 13:00"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 font-bold text-[var(--muted)]"><CalendarDays size={16} /> {formatDate(summary.serviceDate)}</span>
            {summary.pendingExtraRequests > 0 ? <span className="rounded-full bg-red-50 px-3 py-2 font-bold text-[var(--danger)]">{summary.pendingExtraRequests} extra(s) pendientes</span> : null}
          </div>

          <DeliveryProgress
            key={summary.serviceDate}
            tracking={summary.delivery}
            serviceDate={summary.serviceDate}
            viewerRole={viewerRole}
            onUpdate={(delivery) =>
              setSummary((current) =>
                current
                  ? {
                      ...current,
                      delivery,
                      totals: delivery.receiptConfirmedAt
                        ? { ...current.totals, delivered: current.totals.colations }
                        : current.totals,
                    }
                  : current,
              )
            }
          />

          <div className="provider-stagger-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={PackageCheck} label="Colaciones" value={summary.totals.colations} accent />
            <Metric icon={UsersRound} label="Trabajadores" value={summary.totals.byKind.regular} />
            <Metric icon={UsersRound} label="Capacitaciones" value={summary.totals.byKind.training} />
            <Metric icon={UsersRound} label="Extras" value={summary.totals.byKind.extra} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Breakdown title="Preparaciones" rows={summary.menuBreakdown.map((item) => ({ label: `${item.label} · ${item.description}`, quantity: item.quantity }))} />
            <Breakdown title="Complementos y componentes" rows={[
              { label: "Ensaladas", quantity: summary.totals.sides.ensalada },
              { label: "Postres elegidos", quantity: summary.totals.sides.postre },
              { label: "Panes", quantity: summary.totals.bread },
              { label: "Tés", quantity: summary.totals.tea },
              ...summary.components,
            ].filter((item) => item.quantity > 0)} />
          </div>

          <div className="daily-summary-details space-y-5 print:hidden">
            {summary.trainingGroups.length > 0 ? <Breakdown title="Capacitaciones" rows={summary.trainingGroups.map((group) => ({ label: group.name, quantity: group.quantity }))} /> : null}

            <div className="card overflow-hidden">
              <div className="border-b border-[var(--line)] px-5 py-4">
                <h3 className="font-black">Detalle para preparación y entrega</h3>
                <p className="text-xs text-[var(--muted)]">La proveedora etiqueta; despacho utiliza esta nómina para verificar la carga y la entrega.</p>
              </div>
              <div className="mobile-scroll-tabs max-w-full overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--muted)]"><tr><th className="p-3">Nombre / grupo</th><th className="p-3">Tipo</th><th className="p-3">Menú</th><th className="p-3">Complemento</th><th className="p-3 text-right">Cantidad</th></tr></thead>
                  <tbody>{summary.manifest.map((item) => <tr key={item.orderId} className="border-t border-[var(--line)]"><td className="p-3 font-bold">{item.beneficiary}{item.employeeCode ? <span className="block text-xs font-normal text-[var(--muted)]">{item.employeeCode}</span> : null}</td><td className="p-3">{kindLabel(item.kind)}</td><td className="p-3"><span className="font-bold">{item.menuLabel}</span><span className="block text-xs text-[var(--muted)]">{item.menuDescription}</span></td><td className="p-3">{sideLabel(item.side)} · {item.bread ? "Pan" : "Té"}</td><td className="p-3 text-right text-lg font-black">{item.quantity}</td></tr>)}</tbody>
                </table>
                {summary.manifest.length === 0 ? <p className="p-8 text-center text-sm text-[var(--muted)]">Aún no hay colaciones confirmadas.</p> : null}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Metric({ icon: Icon, label, value, accent = false }: { icon: typeof PackageCheck; label: string; value: number; accent?: boolean }) {
  return <article className={`provider-card-motion rounded-2xl border border-[var(--line)] p-5 ${accent ? "bg-[linear-gradient(135deg,var(--brand-strong),var(--accent))] text-white" : "bg-white"}`}><Icon size={19} /><strong className="mt-4 block text-3xl font-black">{value}</strong><span className={`text-sm font-bold ${accent ? "text-white/80" : "text-[var(--muted)]"}`}>{label}</span></article>;
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ label: string; quantity: number }> }) {
  return <article className="card p-5"><h3 className="font-black">{title}</h3><div className="mt-4 space-y-2">{rows.map((row, index) => <div key={`${row.label}-${index}`} className="flex items-center justify-between gap-4 rounded-xl bg-[var(--surface-muted)] px-3 py-2"><span className="text-sm font-semibold">{row.label}</span><strong className="text-lg">{row.quantity}</strong></div>)}{rows.length === 0 ? <p className="text-sm text-[var(--muted)]">Sin registros.</p> : null}</div></article>;
}

function chileToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T12:00:00Z`)); }
function sideLabel(value: string) { return value === "ensalada" ? "Ensalada" : value === "postre" ? "Postre" : "Sin acompañamiento"; }
function kindLabel(value: string) { return value === "regular" ? "Trabajador" : value === "training" ? "Capacitación" : "Extra"; }

const printPageStyle = `
  @page {
    size: A4 landscape;
    margin: 10mm;
  }

  @media print {
    html,
    body {
      margin: 0 !important;
      background: #fff6e5 !important;
      color: #3b2418 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .daily-summary-print {
      width: 100% !important;
      animation: none !important;
    }

    .daily-summary-controls,
    .daily-summary-details {
      display: none !important;
    }

    .daily-summary-print .card,
    .daily-summary-print .provider-stagger-grid > *,
    .daily-summary-print article {
      break-inside: avoid;
      box-shadow: none !important;
    }

    .daily-summary-print .mobile-scroll-tabs {
      max-width: none !important;
      overflow: visible !important;
    }

    .daily-summary-print table {
      width: 100% !important;
    }

    .daily-summary-print tr {
      break-inside: avoid;
    }
  }
`;
