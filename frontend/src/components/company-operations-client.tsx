"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  BellRing,
  Building2,
  CheckCircle2,
  ClipboardPlus,
  Clock3,
  GraduationCap,
  Plus,
  UserPlus,
  UsersRound,
  UtensilsCrossed,
} from "lucide-react";
import { OperationsReports } from "@/components/provider-reports";
import { DailySummary } from "@/components/daily-summary";
import { WorkerManagement } from "@/components/worker-management";
import { browserApiRequest } from "@/lib/api/client";
import type {
  CompanyOperationsDto,
  DailySummaryDto,
  ExceptionDto,
  MenuWeekDto,
  NotificationDto,
  OrderDto,
  OrdersReportDto,
  SideChoice,
  WorkerAccountDto,
} from "@/lib/api/contracts";
import {
  formatChileanDateWithWeekday,
  formatChileanTabDate,
} from "@/lib/date-format";
import { isTrainingRegistrationOpen } from "@/lib/business-rules";

type Mode = "training" | "extra";
type View = "operations" | "summary" | "reports" | "workers";

const modes = [
  {
    value: "training",
    label: "Capacitación",
    schedule: "Hasta 09:00 · desde 14:00",
    description: "Registra a todos los alumnos como un solo grupo.",
    icon: GraduationCap,
  },
  {
    value: "extra",
    label: "Colación extra",
    schedule: "08:00 a 13:00",
    description: "Directa hasta las 11:00; después requiere aprobación de la proveedora.",
    icon: UserPlus,
  },
] as const;

export function CompanyOperationsClient({
  menu,
  initialOperations,
  initialReport,
  notifications,
  nowIso,
  initialSummary,
  initialWorkers,
  initialView,
}: {
  menu: MenuWeekDto | null;
  initialOperations: CompanyOperationsDto | null;
  initialReport: OrdersReportDto;
  notifications: NotificationDto[];
  nowIso: string;
  initialSummary: DailySummaryDto | null;
  initialWorkers: WorkerAccountDto[];
  initialView?: View;
}) {
  const currentDate = localDate(new Date(nowIso));
  const initialDayId =
    menu?.days.find((day) => day.serviceDate === currentDate)?.id ??
    menu?.days.find((day) => !day.disabled)?.id ??
    menu?.days[0]?.id ??
    "";
  const [operations, setOperations] = useState(initialOperations);
  const [activeDayId, setActiveDayId] = useState(initialDayId);
  const [mode, setMode] = useState<Mode>("training");
  const [view, setView] = useState<View>(initialView ?? "operations");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date(nowIso).getTime());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const activeDay = menu?.days.find((day) => day.id === activeDayId);
  const orders = operations?.orders ?? [];
  const activeOrders = orders.filter(
    (order) => order.serviceDayId === activeDayId && order.status === "confirmed",
  );
  const activeExceptions = (operations?.extraRequests ?? []).filter(
    (item) => item.serviceDayId === activeDayId,
  );
  const trainingMenu = activeDay?.options.find(
    (option) => option.trainingMenu && option.visible,
  );
  const now = new Date(currentTime);
  const blocked =
    operations?.calendarBlocks.some(
      (block) =>
        activeDay &&
        activeDay.serviceDate >= block.startsOn &&
        activeDay.serviceDate <= block.endsOn &&
        ["holiday", "vacation", "no_service"].includes(block.kind),
    ) ?? false;
  const trainingOpen = Boolean(
    activeDay &&
      !activeDay.disabled &&
      isTrainingRegistrationOpen(activeDay.serviceDate, now, blocked) &&
      trainingMenu,
  );
  const extraOpen = Boolean(
    activeDay &&
      !activeDay.disabled &&
      !blocked &&
      now >= new Date(activeDay.sameDayOpensAt) &&
      now < new Date(activeDay.deliveryClosesAt),
  );
  const lateExtra = Boolean(activeDay && now >= new Date(activeDay.sameDayClosesAt));
  const modeOpen = mode === "training" ? trainingOpen : extraOpen;
  const selectedMode = modes.find((item) => item.value === mode) ?? modes[0];
  const unreadNotifications = notifications.filter((item) => !item.readAt).length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeDay || !modeOpen) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const complement = String(form.get("complement"));
    const common = {
      serviceDayId: activeDay.id,
      menuOptionId:
        mode === "training" ? trainingMenu?.id : String(form.get("menuOptionId")),
      side: String(form.get("side")) as SideChoice,
      bread: complement === "bread",
      tea: complement === "tea",
    };

    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (mode === "training") {
        const name = String(form.get("name"));
        const attendeeCount = Number(form.get("quantity"));
        const order = await browserApiRequest<OrderDto>(
          "/api/v1/company/training-sessions",
          {
            method: "POST",
            body: JSON.stringify({ ...common, name, attendeeCount }),
          },
        );
        setOperations((current) =>
          current
            ? {
                ...current,
                orders: [order, ...current.orders],
                trainingSessions: [
                  {
                    id: order.trainingSessionId ?? order.id,
                    name,
                    serviceDate: activeDay.serviceDate,
                    expectedAttendees: attendeeCount,
                    createdAt: order.createdAt,
                  },
                  ...current.trainingSessions,
                ],
              }
            : current,
        );
      } else {
        const result = await browserApiRequest<
          | { outcome: "confirmed"; order: OrderDto }
          | { outcome: "pending"; request: ExceptionDto }
        >("/api/v1/company/extras", {
          method: "POST",
          body: JSON.stringify({
            ...common,
            beneficiaryLabel: String(form.get("name")),
            ...(lateExtra ? { reason: String(form.get("reason")) } : {}),
          }),
        });
        setOperations((current) =>
          current
            ? result.outcome === "confirmed"
              ? { ...current, orders: [result.order, ...current.orders] }
              : { ...current, extraRequests: [result.request, ...current.extraRequests] }
            : current,
        );
      }
      formElement.reset();
      setMessage(
        mode === "extra" && lateExtra
          ? "Solicitud de colación extra enviada a la proveedora."
          : "Colaciones agregadas correctamente.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="company-shell-enter page-shell">
      <div className="company-header-enter flex min-w-0 flex-wrap justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Panel empresa</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Administración Securitas</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Gestiona capacitaciones y colaciones extra con sus horarios de aprobación.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <span className="company-badge-enter inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-extrabold text-[var(--warning)]">
            <Building2 size={15} /> Acceso autorizado
          </span>
          <span className="company-badge-enter inline-flex items-center gap-2 rounded-full bg-[var(--brand-soft)] px-3 py-2 text-xs font-extrabold text-[var(--brand-strong)]">
            <BellRing size={15} /> {unreadNotifications} avisos
          </span>
        </div>
      </div>

      <div
        className="company-tabs-enter mt-6 grid w-full grid-cols-2 rounded-xl bg-[var(--surface-muted)] p-1 md:inline-flex md:w-auto"
        role="tablist"
        aria-label="Secciones de administración Securitas"
      >
        <button
          type="button"
          onClick={() => setView("workers")}
          role="tab"
          aria-selected={view === "workers"}
          className={`company-tab inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-center text-sm font-extrabold sm:min-h-10 sm:px-4 ${
            view === "workers"
              ? "bg-white text-[var(--brand)] shadow-sm"
              : "text-[var(--muted)]"
          }`}
        >
          <UserPlus size={17} /> Trabajadores
        </button>
        <button
          type="button"
          onClick={() => setView("summary")}
          role="tab"
          aria-selected={view === "summary"}
          className={`company-tab inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-center text-sm font-extrabold sm:min-h-10 sm:px-4 ${
            view === "summary" ? "bg-white text-[var(--brand)] shadow-sm" : "text-[var(--muted)]"
          }`}
        >
          <UsersRound size={17} /> Resumen diario
        </button>
        <button
          type="button"
          onClick={() => setView("operations")}
          role="tab"
          aria-selected={view === "operations"}
          className={`company-tab inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-center text-sm font-extrabold sm:min-h-10 sm:px-4 ${
            view === "operations"
              ? "bg-white text-[var(--brand)] shadow-sm"
              : "text-[var(--muted)]"
          }`}
        >
          <ClipboardPlus size={17} /> Operaciones
        </button>
        <button
          type="button"
          onClick={() => setView("reports")}
          role="tab"
          aria-selected={view === "reports"}
          className={`company-tab inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-center text-sm font-extrabold sm:min-h-10 sm:px-4 ${
            view === "reports"
              ? "bg-white text-[var(--brand)] shadow-sm"
              : "text-[var(--muted)]"
          }`}
        >
          <BarChart3 size={17} /> Reportes
        </button>
      </div>

      {view === "summary" ? (
        <div className="mt-7"><DailySummary initialSummary={initialSummary} /></div>
      ) : view === "workers" ? (
        <WorkerManagement initialWorkers={initialWorkers} />
      ) : view === "reports" ? (
        <OperationsReports endpoint="/api/v1/company/reports" initialReport={initialReport} />
      ) : !menu || !operations ? (
        <section className="company-panel-enter mt-7">
          <div className="company-card-motion card p-8 text-center">
            <UtensilsCrossed size={28} className="mx-auto text-[var(--brand)]" />
            <h2 className="mt-3 text-xl font-black">No hay un menú semanal publicado</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              La proveedora debe publicar el menú antes de registrar operaciones.
            </p>
          </div>
        </section>
      ) : (
        <section className="company-panel-enter mt-7">
          <div className="company-day-tabs mobile-scroll-tabs flex gap-2 overflow-x-auto pb-1">
            {menu.days.map((day) => (
              <button
                key={day.id}
                type="button"
                onClick={() => {
                  setActiveDayId(day.id);
                  setMessage("");
                  setError("");
                }}
                aria-pressed={day.id === activeDayId}
                className={`company-tab min-w-32 snap-start rounded-xl border px-3 py-2.5 font-bold sm:min-w-36 sm:px-4 ${
                  day.id === activeDayId
                    ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                    : "border-[var(--line)] bg-white"
                }`}
              >
                {formatChileanTabDate(day.serviceDate)}
              </button>
            ))}
          </div>

          <div className="company-selected-day mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">
                Día seleccionado
              </p>
              <p className="mt-1 font-black capitalize">
                {activeDay ? formatChileanDateWithWeekday(activeDay.serviceDate) : "Sin fecha"}
              </p>
            </div>
            {blocked || activeDay?.disabled ? (
              <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-extrabold text-[var(--danger)]">
                Sin servicio
              </span>
            ) : (
              <span className="rounded-full bg-[var(--herb-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--herb-strong)]">
                Servicio habilitado
              </span>
            )}
          </div>

          <div className="company-stagger-grid mt-5 grid gap-4 sm:grid-cols-3">
            <Metric
              icon={UsersRound}
              label="Colaciones operativas"
              value={activeOrders.reduce((sum, order) => sum + order.quantity, 0)}
            />
            <Metric
              icon={GraduationCap}
              label="Alumnos en capacitación"
              value={activeOrders
                .filter((order) => order.kind === "training")
                .reduce((sum, order) => sum + order.quantity, 0)}
            />
            <Metric
              icon={AlertCircle}
              label="Extras pendientes"
              value={activeExceptions.filter((item) => item.status === "pending").length}
            />
          </div>

          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1.08fr_.92fr]">
            <section className="company-card-motion card p-6">
              <p className="eyebrow">Nuevo registro</p>
              <h2 className="mt-1 text-xl font-black">¿Qué necesitas agregar?</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Elige el tipo de colación y completa solo la información necesaria.
              </p>

              <div className="company-mode-grid mt-5 grid gap-3 sm:grid-cols-2">
                {modes.map((item) => {
                  const Icon = item.icon;
                  const selected = mode === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setMode(item.value);
                        setMessage("");
                        setError("");
                      }}
                      aria-pressed={selected}
                      className={`company-mode-card rounded-xl border p-3 text-left ${
                        selected
                          ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                          : "border-[var(--line)] bg-white text-[var(--foreground)]"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-black">
                        <Icon size={17} /> {item.label}
                      </span>
                      <span className="mt-1 block text-xs font-bold opacity-75">
                        {item.schedule}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div key={mode} className="company-form-enter">
                <div
                  className={`mt-4 flex items-start gap-3 rounded-xl p-3 text-sm ${
                    modeOpen
                      ? "bg-[var(--herb-soft)] text-[var(--herb-strong)]"
                      : "bg-[var(--accent-soft)] text-[var(--warning)]"
                  }`}
                >
                  {modeOpen ? (
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                  ) : (
                    <Clock3 size={18} className="mt-0.5 shrink-0" />
                  )}
                  <div>
                    <strong>{modeOpen ? "Ventana habilitada" : "Ventana cerrada"}</strong>
                    <p className="mt-0.5 text-xs font-semibold opacity-80">
                      {modeOpen
                        ? selectedMode.description
                        : closedWindowMessage(mode, blocked || Boolean(activeDay?.disabled))}
                    </p>
                  </div>
                </div>

                <form
                  key={`${activeDayId}-${mode}`}
                  onSubmit={submit}
                  className="mt-5 space-y-4"
                >
                  <Field label={mode === "training" ? "Nombre de la capacitación" : "Persona o referencia"}>
                    <input
                      name="name"
                      required
                      minLength={2}
                      placeholder={
                        mode === "training" ? "Ej.: Inducción nuevos guardias" : "Ej.: Visita externa"
                      }
                      className="company-input min-h-12 w-full rounded-xl border border-[var(--line)] px-3"
                    />
                  </Field>

                  {mode === "training" ? (
                    <>
                      <Field label="Cantidad de alumnos">
                        <input
                          name="quantity"
                          type="number"
                          min="1"
                          max="500"
                          required
                          placeholder="Ej.: 30"
                          className="company-input min-h-12 w-full rounded-xl border border-[var(--line)] px-3"
                        />
                      </Field>
                      <div className="rounded-xl bg-[var(--surface-muted)] p-3">
                        <p className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">
                          Menú de capacitación
                        </p>
                        <p className="mt-1 text-sm font-bold">
                          {trainingMenu
                            ? `${trainingMenu.label} · ${trainingMenu.description}`
                            : "La proveedora aún no lo ha definido"}
                        </p>
                      </div>
                    </>
                  ) : (
                    <Field label="Menú solicitado">
                      <select
                        name="menuOptionId"
                        required
                        className="company-input min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3"
                      >
                        {activeDay?.options
                          .filter((option) => option.visible && option.availableForWorkers)
                          .map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label} · {option.description}
                            </option>
                          ))}
                      </select>
                    </Field>
                  )}

                  <Field label="Acompañamiento">
                    <select
                      name="side"
                      required
                      className="company-input min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3"
                    >
                      <option value="ensalada">Ensalada</option>
                      <option value="postre">Postre</option>
                      <option value="ninguno">Ninguno</option>
                    </select>
                  </Field>

                  <fieldset>
                    <legend className="text-sm font-extrabold">Complemento</legend>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      {[
                        ["bread", "Pan"],
                        ["tea", "Té"],
                      ].map(([value, label]) => (
                        <label
                          key={value}
                          className="company-choice cursor-pointer rounded-xl border border-[var(--line)] bg-white p-3 font-bold"
                        >
                          <input
                            name="complement"
                            type="radio"
                            value={value}
                            required
                            className="mr-2 accent-[var(--brand)]"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {mode === "extra" && lateExtra ? (
                    <Field label="Motivo de la solicitud tardía">
                      <textarea
                        name="reason"
                        required
                        minLength={5}
                        rows={3}
                        placeholder="Explica por qué se necesita después de las 11:00"
                        className="company-input w-full rounded-xl border border-[var(--line)] p-3"
                      />
                    </Field>
                  ) : null}

                  <button
                    type="submit"
                    disabled={!modeOpen || saving}
                    className="company-action flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus size={17} />
                    {saving
                      ? "Guardando…"
                      : mode === "extra" && lateExtra
                        ? "Enviar solicitud"
                        : "Agregar al conteo"}
                  </button>
                </form>

                {message ? (
                  <p
                    role="status"
                    className="company-feedback-enter mt-3 rounded-xl bg-[var(--herb-soft)] p-3 text-sm font-bold text-[var(--herb-strong)]"
                  >
                    {message}
                  </p>
                ) : null}
                {error ? (
                  <p
                    role="alert"
                    className="company-feedback-enter mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]"
                  >
                    {error}
                  </p>
                ) : null}
              </div>
            </section>

            <aside className="space-y-5">
              <section className="company-card-motion card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-black">Solicitudes tardías de extras</h2>
                  <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-extrabold">
                    {activeExceptions.length}
                  </span>
                </div>
                <div className="company-list-enter mt-4 space-y-3">
                  {activeExceptions.length ? (
                    activeExceptions.map((item) => (
                      <div
                        key={item.id}
                        className="company-list-item rounded-xl border border-[var(--line)] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <strong>{item.beneficiaryLabel}</strong>
                            <p className="mt-1 text-xs text-[var(--muted)]">{item.reason}</p>
                          </div>
                          <StatusBadge status={item.status} />
                        </div>
                        {item.resolutionNote ? (
                          <p className="mt-3 rounded-lg bg-[var(--surface-muted)] p-2 text-xs text-[var(--muted)]">
                            {item.resolutionNote}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <EmptyState text="Sin solicitudes para este día." />
                  )}
                </div>
              </section>

              <section className="company-card-motion card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-black">Notificaciones</h2>
                  <BellRing size={18} className="text-[var(--brand)]" />
                </div>
                <div className="company-list-enter mt-3 space-y-2">
                  {notifications.length ? (
                    notifications.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="company-list-item rounded-xl bg-[var(--surface-muted)] p-3 text-sm"
                      >
                        <strong className="block">{item.title}</strong>
                        <p className="mt-1 text-xs text-[var(--muted)]">{item.message}</p>
                      </div>
                    ))
                  ) : (
                    <EmptyState text="No tienes notificaciones nuevas." />
                  )}
                </div>
              </section>
            </aside>
          </div>
        </section>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-extrabold">
      {label}
      <span className="mt-2 block font-normal">{children}</span>
    </label>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UsersRound;
  label: string;
  value: number;
}) {
  return (
    <article className="company-card-motion card p-5">
      <Icon size={19} className="text-[var(--herb)]" />
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="text-sm font-bold text-[var(--muted)]">{label}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: ExceptionDto["status"] }) {
  const classes =
    status === "pending"
      ? "bg-[var(--accent-soft)] text-[var(--warning)]"
      : status === "approved"
        ? "bg-[var(--herb-soft)] text-[var(--herb-strong)]"
        : "bg-red-50 text-[var(--danger)]";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${classes}`}>
      {statusLabel(status)}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line)] p-5 text-center">
      <p className="text-sm text-[var(--muted)]">{text}</p>
    </div>
  );
}

function closedWindowMessage(mode: Mode, blocked: boolean) {
  if (blocked) return "La fecha está bloqueada por feriado, vacaciones o día sin servicio.";
  if (mode === "training") {
    return "Puedes registrar fechas actuales o futuras hasta las 09:00 y nuevamente desde las 14:00.";
  }
  return "Las colaciones extra abren a las 08:00 y cierran por completo a las 13:00.";
}

function localDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}


function statusLabel(status: ExceptionDto["status"]) {
  return status === "pending" ? "Pendiente" : status === "approved" ? "Aprobada" : "Rechazada";
}
