"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BarChart3,
  BellRing,
  Check,
  ChefHat,
  LayoutDashboard,
  ListChecks,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ProviderMenuEditor } from "@/components/provider-menu-editor";
import { OperationsReports } from "@/components/provider-reports";
import { DailySummary } from "@/components/daily-summary";
import { SuccessDialog } from "@/components/ui/success-dialog";
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
import { formatRefreshTime, useAutoRefresh } from "@/hooks/use-auto-refresh";

type View = "production" | "summary" | "menu" | "reports";

const DEFAULT_TAB_ORDER: View[] = ["menu", "production", "summary", "reports"];
const PROVIDER_TABS = {
  production: { label: "Producción", icon: LayoutDashboard },
  summary: { label: "Resumen diario", icon: ListChecks },
  menu: { label: "Menús", icon: ChefHat },
  reports: { label: "Reportes", icon: BarChart3 },
} satisfies Record<View, { label: string; icon: typeof ChefHat }>;

export function ProviderOperationsClient({
  initialOperations,
  initialCurrentMenu,
  initialNextMenu,
  currentStartsOn,
  nextStartsOn,
  initialReport,
  notifications,
  initialSummary,
}: {
  initialOperations: ProviderOperationsDto | null;
  initialCurrentMenu: MenuWeekDto | null;
  initialNextMenu: MenuWeekDto | null;
  currentStartsOn: string;
  nextStartsOn: string;
  initialReport: OrdersReportDto;
  notifications: NotificationDto[];
  initialSummary: DailySummaryDto | null;
}) {
  const [operations, setOperations] = useState(initialOperations);
  const [currentMenu, setCurrentMenu] = useState(initialCurrentMenu);
  const [nextMenu, setNextMenu] = useState(initialNextMenu);
  const [menuPeriod, setMenuPeriod] = useState<"current" | "next">(
    initialCurrentMenu ? "next" : "current",
  );
  const [liveNotifications, setLiveNotifications] = useState(notifications);
  const [view, setView] = useState<View>("menu");
  const [activeDayId, setActiveDayId] = useState(initialOperations?.menu.days[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});

  const refreshOperations = useCallback(async () => {
    const [nextOperations, nextNotifications] = await Promise.all([
      browserApiRequest<ProviderOperationsDto>(
        `/api/v1/provider/operations?startsOn=${currentStartsOn}`,
      ),
      browserApiRequest<NotificationDto[]>("/api/v1/notifications?limit=20"),
    ]);
    setOperations(nextOperations);
    setLiveNotifications(nextNotifications);
    setActiveDayId((current) =>
      nextOperations.menu.days.some((day) => day.id === current)
        ? current
        : (nextOperations.menu.days[0]?.id ?? ""),
    );
  }, [currentStartsOn]);
  const { lastUpdatedAt, refreshError, refreshing, refreshNow } = useAutoRefresh(
    refreshOperations,
    { enabled: view === "production" && !saving },
  );

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
    capacity: number,
  ) {
    setSaving(true);
    setError("");
    try {
      const updated = await browserApiRequest<{
        id: string;
        capacity: number;
        capacityUpdatedAt: string;
        visible: boolean;
      }>(`/api/v1/provider/menu-options/${optionId}/availability`, {
          method: "PATCH",
          body: JSON.stringify({ capacity }),
        });
      setOperations((current) =>
        current
          ? { ...current, menu: updateMenuCapacity(current.menu, updated) }
          : current,
      );
      setCurrentMenu((current) =>
        current ? updateMenuCapacity(current, updated) : current,
      );
      setMessage("Cupo total actualizado.");
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
      <div className="provider-header-enter grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <p className="eyebrow">Panel proveedor</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Gestión de colaciones</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Producción real, menús semanales y reportes.
          </p>
        </div>
        <div className="flex min-h-10 flex-wrap items-center gap-2 md:justify-end">
          <span className="provider-notification-enter inline-flex items-center gap-2 rounded-full bg-[var(--brand-soft)] px-3 py-2 text-xs font-extrabold">
            <BellRing size={15} /> {liveNotifications.filter((item) => !item.readAt).length} avisos
          </span>
          {view === "production" ? (
            <button
              type="button"
              onClick={() => void refreshNow()}
              disabled={refreshing || saving}
              className="provider-action inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 text-xs font-extrabold disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Actualizando…" : "Actualizar"}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="provider-tabs-enter mt-6 grid w-full grid-cols-2 rounded-xl bg-[var(--surface-muted)] p-1 md:inline-flex md:w-auto"
        role="tablist"
        aria-label="Secciones de administración proveedora"
      >
        {DEFAULT_TAB_ORDER.map((value) => {
          const { label, icon: Icon } = PROVIDER_TABS[value];
          return (
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
          );
        })}
      </div>

      <SuccessDialog message={message || null} onClose={() => setMessage("")} />
      {error ? (
        <p role="alert" className="provider-feedback-enter mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {view === "production" ? (
        <p role="status" className="mt-3 text-xs font-bold text-[var(--muted)]">
          {refreshError || formatRefreshTime(lastUpdatedAt)}
        </p>
      ) : null}

      {view === "summary" ? (
        <div className="mt-7"><DailySummary initialSummary={initialSummary} viewerRole="provider_admin" /></div>
      ) : view === "reports" ? (
        <OperationsReports endpoint="/api/v1/provider/reports" initialReport={initialReport} />
      ) : view === "menu" ? (
        <section className="mt-6 space-y-4">
          <div
            className="grid w-full grid-cols-2 rounded-xl bg-[var(--surface-muted)] p-1 sm:w-fit"
            role="tablist"
            aria-label="Semana del menú"
          >
            {(
              [
                ["current", "Semana actual"],
                ["next", "Próxima semana"],
              ] as const
            ).map(([period, label]) => (
              <button
                key={period}
                type="button"
                role="tab"
                aria-selected={menuPeriod === period}
                onClick={() => setMenuPeriod(period)}
                className={`menu-action min-h-11 rounded-lg px-4 text-sm font-extrabold ${
                  menuPeriod === period
                    ? "bg-white text-[var(--brand)] shadow-sm"
                    : "text-[var(--muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {menuPeriod === "current" ? (
            <ProviderMenuEditor
              key={currentStartsOn}
              initialMenu={currentMenu}
              startsOn={currentStartsOn}
              periodLabel="semana actual"
              currentWeek
              onMenuChange={setCurrentMenu}
            />
          ) : (
            <ProviderMenuEditor
              key={nextStartsOn}
              initialMenu={nextMenu}
              startsOn={nextStartsOn}
              periodLabel="próxima semana"
              onMenuChange={setNextMenu}
            />
          )}
        </section>
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
  onUpdateAvailability: (id: string, capacity: number) => Promise<void>;
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
          <div>
            <p className="eyebrow">Control operativo</p>
            <h2 className="mt-1 text-xl font-black">Cupos del día</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Consulta las reservas reales. Ajusta el cupo total solamente ante un cambio de producción.
            </p>
          </div>
          <div className="provider-list-enter mt-4 space-y-3">
            {activeDay?.options
              .filter((option) => option.availableForWorkers && option.visible)
              .map((option) => (
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
                    className="form-control mt-3 min-h-10 px-3 text-sm"
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

function updateMenuCapacity(
  menu: MenuWeekDto,
  updated: {
    id: string;
    capacity: number;
    capacityUpdatedAt: string;
    visible: boolean;
  },
) {
  return {
    ...menu,
    days: menu.days.map((day) => ({
      ...day,
      options: day.options.map((option) =>
        option.id === updated.id
          ? {
              ...option,
              capacity: updated.capacity,
              capacityUpdatedAt: updated.capacityUpdatedAt,
              remainingQuantity: Math.max(
                updated.capacity - option.reservedQuantity,
                0,
              ),
              visible: updated.visible,
            }
          : option,
      ),
    })),
  };
}

function AvailabilityRow({
  option,
  disabled,
  onSave,
}: {
  option: ProviderOperationsDto["menu"]["days"][number]["options"][number];
  disabled: boolean;
  onSave: (id: string, capacity: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [capacity, setCapacity] = useState(option.capacity?.toString() ?? "");
  const parsedCapacity = Number(capacity);
  const validCapacity =
    capacity !== "" &&
    Number.isInteger(parsedCapacity) &&
    parsedCapacity >= option.reservedQuantity;

  async function saveCapacity() {
    if (!validCapacity) return;
    await onSave(option.id, parsedCapacity);
    setOpen(false);
  }

  return (
    <article className="provider-list-item rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <strong className="text-base">{option.label}</strong>
          <p className="mt-1 text-sm text-[var(--muted)]">{option.description}</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
          <AvailabilityMetric label="Cupo total" value={option.capacity ?? "—"} />
          <AvailabilityMetric label="Reservadas" value={option.reservedQuantity} />
          <AvailabilityMetric
            label="Disponibles"
            value={option.remainingQuantity ?? "—"}
            highlight
          />
        </dl>
      </div>
      <div className="mt-4 flex justify-end border-t border-[var(--line)] pt-3">
        <DialogPrimitive.Root
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen) setCapacity(option.capacity?.toString() ?? "");
          }}
        >
          <DialogPrimitive.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="provider-action inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-extrabold text-[var(--ink)] disabled:opacity-40 sm:w-auto"
            >
              <SlidersHorizontal size={16} /> Ajustar cupo total
            </button>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="app-dialog-overlay" />
            <DialogPrimitive.Content className="app-dialog-content">
              <p className="eyebrow">Ajuste excepcional</p>
              <DialogPrimitive.Title className="mt-1 text-xl font-black">
                Ajustar cupo total
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Modifica la capacidad de {option.label} solamente si cambió la producción real. Ya existen {option.reservedQuantity} reservas protegidas.
              </DialogPrimitive.Description>

              <label className="mt-5 block text-sm font-extrabold">
                Nuevo cupo total
                <input
                  type="number"
                  min={option.reservedQuantity}
                  step="1"
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                  className="form-control mt-2 px-4 text-base"
                />
              </label>
              {!validCapacity ? (
                <p role="alert" className="mt-2 text-sm font-bold text-[var(--danger)]">
                  El cupo debe ser un número entero igual o superior a {option.reservedQuantity}.
                </p>
              ) : null}

              <div className="mt-6 grid grid-cols-2 gap-3">
                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-4 font-extrabold"
                  >
                    Volver
                  </button>
                </DialogPrimitive.Close>
                <button
                  type="button"
                  onClick={() => void saveCapacity()}
                  disabled={disabled || !validCapacity}
                  className="min-h-11 rounded-xl bg-[var(--brand)] px-4 font-extrabold text-white disabled:opacity-40"
                >
                  Guardar ajuste
                </button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </article>
  );
}

function AvailabilityMetric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-2 py-3 ${
        highlight ? "bg-[var(--herb-soft)]" : "bg-[var(--surface-muted)]"
      }`}
    >
      <dt className="text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">
        {label}
      </dt>
      <dd
        className={`mt-1 text-xl font-black ${
          highlight ? "text-[var(--herb-strong)]" : "text-[var(--ink)]"
        }`}
      >
        {value}
      </dd>
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
