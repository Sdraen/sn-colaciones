"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  BellRing,
  Check,
  ChefHat,
  LayoutDashboard,
  ListChecks,
  X,
} from "lucide-react";
import { ProviderMenuEditor } from "@/components/provider-menu-editor";
import { OperationsReports } from "@/components/provider-reports";
import { DailySummary } from "@/components/daily-summary";
import { browserApiRequest } from "@/lib/api/client";
import type {
  ExceptionDto,
  DailySummaryDto,
  MenuWeekDto,
  NotificationDto,
  OrdersReportDto,
  ProviderOperationsDto,
} from "@/lib/api/contracts";
import { formatChileanTabDate } from "@/lib/date-format";

type View = "production" | "summary" | "menu" | "reports";

export function ProviderOperationsClient({
  initialOperations,
  initialNextMenu,
  nextStartsOn,
  initialReport,
  notifications,
  initialSummary,
}: {
  initialOperations: ProviderOperationsDto | null;
  initialNextMenu: MenuWeekDto | null;
  nextStartsOn: string;
  initialReport: OrdersReportDto;
  notifications: NotificationDto[];
  initialSummary: DailySummaryDto | null;
}) {
  const [operations, setOperations] = useState(initialOperations);
  const [view, setView] = useState<View>(initialOperations ? "production" : "menu");
  const [activeDayId, setActiveDayId] = useState(initialOperations?.menu.days[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});

  const activeDay = operations?.menu.days.find((day) => day.id === activeDayId);
  const pending = operations?.extraRequests.filter((request) => request.status === "pending") ?? [];
  const summary = useMemo(
    () =>
      (operations?.orders ?? [])
        .filter(
          (order) => order.serviceDayId === activeDayId && order.status === "confirmed",
        )
        .reduce(
          (result, order) => ({
            total: result.total + order.quantity,
            bread: result.bread + (order.bread ? order.quantity : 0),
            tea: result.tea + (order.tea ? order.quantity : 0),
          }),
          { total: 0, bread: 0, tea: 0 },
        ),
    [activeDayId, operations?.orders],
  );

  async function updateAvailability(
    optionId: string,
    capacity: number | null,
    visible: boolean,
  ) {
    setSaving(true);
    setError("");
    try {
      await browserApiRequest(`/api/v1/provider/menu-options/${optionId}/availability`, {
        method: "PATCH",
        body: JSON.stringify({ capacity, visible }),
      });
      setMessage("Disponibilidad actualizada.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible actualizar");
    } finally {
      setSaving(false);
    }
  }

  async function resolve(request: ExceptionDto, status: "approved" | "rejected") {
    const resolutionNote = rejectionNotes[request.id]?.trim();
    if (status === "rejected" && !resolutionNote) return;
    setSaving(true);
    setError("");
    try {
      const result = await browserApiRequest<{
        id: string;
        status: "approved" | "rejected";
        resolutionNote: string | null;
        resolvedAt: string;
      }>(`/api/v1/provider/extra-requests/${request.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(resolutionNote ? { resolutionNote } : {}) }),
      });
      setOperations((current) =>
        current
          ? {
              ...current,
              extraRequests: current.extraRequests.map((item) =>
                item.id === request.id
                  ? {
                      ...item,
                      status: result.status,
                      resolutionNote: result.resolutionNote,
                      resolvedAt: result.resolvedAt,
                    }
                  : item,
              ),
            }
          : current,
      );
      setMessage("Solicitud resuelta.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible resolver");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell provider-shell-enter">
      <div className="provider-header-enter flex min-w-0 flex-wrap justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Panel proveedor</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Gestión de colaciones</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Producción real, menú de la próxima semana y reportes.
          </p>
        </div>
        <span className="provider-notification-enter inline-flex items-center gap-2 rounded-full bg-[var(--brand-soft)] px-3 py-2 text-xs font-extrabold">
          <BellRing size={15} /> {notifications.filter((item) => !item.readAt).length} avisos
        </span>
      </div>

      <div
        className="provider-tabs-enter mt-6 grid w-full grid-cols-2 rounded-xl bg-[var(--surface-muted)] p-1 md:inline-flex md:w-auto"
        role="tablist"
        aria-label="Secciones de administración proveedora"
      >
        {(
          [
            ["production", "Producción", LayoutDashboard],
            ["summary", "Resumen diario", ListChecks],
            ["menu", "Próxima semana", ChefHat],
            ["reports", "Reportes", BarChart3],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => {
              setView(value);
              setMessage("");
              setError("");
            }}
            className={`provider-tab inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-center text-sm font-extrabold sm:min-h-10 sm:px-4 ${
              view === value
                ? "bg-white text-[var(--brand)] shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            <Icon size={17} /> {label}
          </button>
        ))}
      </div>

      {message ? (
        <p
          role="status"
          className="provider-feedback-enter mt-4 rounded-xl bg-[var(--herb-soft)] p-3 text-sm font-bold text-[var(--herb-strong)]"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="provider-feedback-enter mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {view === "summary" ? (
        <div className="mt-7"><DailySummary initialSummary={initialSummary} /></div>
      ) : view === "reports" ? (
        <OperationsReports endpoint="/api/v1/provider/reports" initialReport={initialReport} />
      ) : view === "menu" ? (
        <ProviderMenuEditor initialMenu={initialNextMenu} startsOn={nextStartsOn} />
      ) : (
        <ProductionView
          operations={operations}
          activeDayId={activeDayId}
          activeDay={activeDay}
          summary={summary}
          pending={pending}
          saving={saving}
          rejectionNotes={rejectionNotes}
          onSelectDay={setActiveDayId}
          onUpdateAvailability={updateAvailability}
          onResolve={resolve}
          onChangeRejectionNote={(requestId, value) =>
            setRejectionNotes((current) => ({ ...current, [requestId]: value }))
          }
        />
      )}
    </main>
  );
}

function ProductionView({
  operations,
  activeDayId,
  activeDay,
  summary,
  pending,
  saving,
  rejectionNotes,
  onSelectDay,
  onUpdateAvailability,
  onResolve,
  onChangeRejectionNote,
}: {
  operations: ProviderOperationsDto | null;
  activeDayId: string;
  activeDay: ProviderOperationsDto["menu"]["days"][number] | undefined;
  summary: { total: number; bread: number; tea: number };
  pending: ExceptionDto[];
  saving: boolean;
  rejectionNotes: Record<string, string>;
  onSelectDay: (id: string) => void;
  onUpdateAvailability: (id: string, capacity: number | null, visible: boolean) => Promise<void>;
  onResolve: (request: ExceptionDto, status: "approved" | "rejected") => Promise<void>;
  onChangeRejectionNote: (requestId: string, value: string) => void;
}) {
  if (!operations) {
    return (
      <section className="provider-panel-enter mt-6">
        <div className="provider-card-motion card p-8 text-center">
          <h2 className="text-xl font-black">Aún no existe un menú publicado para esta semana</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Puedes preparar la próxima semana desde la pestaña correspondiente.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="provider-panel-enter mt-6">
      <div className="provider-day-tabs mobile-scroll-tabs flex gap-2 overflow-x-auto pb-1">
        {operations.menu.days.map((day) => (
          <button
            key={day.id}
            type="button"
            onClick={() => onSelectDay(day.id)}
            className={`provider-tab min-w-32 snap-start rounded-xl border px-3 py-2.5 font-bold sm:min-w-36 sm:px-4 ${
              activeDayId === day.id ? "bg-[var(--brand)] text-white" : "bg-white"
            }`}
          >
            {formatChileanTabDate(day.serviceDate)}
          </button>
        ))}
      </div>
      <div className="provider-stagger-grid mt-5 grid gap-4 sm:grid-cols-3">
        <Metric label="Total" value={summary.total} />
        <Metric label="Pan" value={summary.bread} />
        <Metric label="Té" value={summary.tea} />
      </div>
      <div className="provider-stagger-grid mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[1fr_.9fr]">
        <div className="provider-card-motion card min-w-0 p-5">
          <h2 className="text-xl font-black">Disponibilidad del día</h2>
          <div className="provider-list-enter mt-4 space-y-3">
            {activeDay?.options.map((option) => (
              <AvailabilityRow
                key={option.id}
                option={option}
                disabled={saving}
                onSave={onUpdateAvailability}
              />
            ))}
          </div>
        </div>
        <div className="provider-card-motion card min-w-0 p-5">
          <h2 className="text-xl font-black">Solicitudes pendientes</h2>
          <div className="provider-list-enter mt-4 space-y-4">
            {pending.length ? (
              pending.map((request) => (
                <div key={request.id} className="rounded-xl border border-[var(--line)] p-4">
                  <strong>{request.beneficiaryLabel}</strong>
                  <p className="mt-1 text-sm text-[var(--muted)]">{request.reason}</p>
                  <input
                    value={rejectionNotes[request.id] ?? ""}
                    onChange={(event) => onChangeRejectionNote(request.id, event.target.value)}
                    placeholder="Motivo de rechazo"
                    className="mt-3 min-h-10 w-full rounded-xl border border-[var(--line)] px-3 text-sm"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onResolve(request, "rejected")}
                      disabled={!rejectionNotes[request.id]?.trim()}
                      className="provider-action inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-[var(--danger)] disabled:opacity-40"
                    >
                      <X size={15} /> Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={() => onResolve(request, "approved")}
                      className="provider-action inline-flex items-center gap-1 rounded-lg bg-[var(--herb-soft)] px-3 py-2 text-sm font-bold text-[var(--herb-strong)]"
                    >
                      <Check size={15} /> Aprobar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No hay solicitudes pendientes.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AvailabilityRow({
  option,
  disabled,
  onSave,
}: {
  option: ProviderOperationsDto["menu"]["days"][number]["options"][number];
  disabled: boolean;
  onSave: (id: string, capacity: number | null, visible: boolean) => Promise<void>;
}) {
  const [capacity, setCapacity] = useState(option.capacity?.toString() ?? "");
  const [visible, setVisible] = useState(option.visible);

  return (
    <div className="provider-list-item grid min-w-0 gap-3 rounded-xl border border-[var(--line)] p-3 sm:grid-cols-[1fr_.6fr_auto]">
      <div className="min-w-0">
        <strong>{option.label}</strong>
        <p className="text-xs text-[var(--muted)]">{option.description}</p>
      </div>
      <input
        type="number"
        min="0"
        value={capacity}
        onChange={(event) => setCapacity(event.target.value)}
        className="min-h-10 min-w-0 w-full rounded-xl border border-[var(--line)] px-3"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSave(option.id, capacity === "" ? null : Number(capacity), visible)}
        className="provider-action rounded-xl bg-[var(--brand)] px-3 font-bold text-white disabled:opacity-40"
      >
        Guardar
      </button>
      <label className="text-xs font-bold">
        <input
          type="checkbox"
          checked={visible}
          onChange={(event) => setVisible(event.target.checked)}
          className="mr-2"
        />
        Visible
      </label>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="provider-card-motion card p-5">
      <p className="text-3xl font-black">{value}</p>
      <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
    </article>
  );
}
