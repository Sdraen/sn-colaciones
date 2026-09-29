"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardPlus,
  Clock3,
  GraduationCap,
  Plus,
  Sparkles,
  Trash2,
  RefreshCw,
  UserPlus,
  UsersRound,
  UtensilsCrossed,
} from "lucide-react";
import { OperationsReports } from "@/components/provider-reports";
import { DailySummary } from "@/components/daily-summary";
import { WorkerManagement } from "@/components/worker-management";
import {
  ExtraRequestActions,
  OperationalOrderActions,
} from "@/components/company-operation-actions";
import { FormSelect } from "@/components/ui/form-select";
import { SuccessDialog } from "@/components/ui/success-dialog";
import { browserApiRequest } from "@/lib/api/client";
import type {
  CompanyOperationsDto,
  DailySummaryDto,
  ExceptionDto,
  MenuWeekDto,
  OrdersReportDto,
  SideChoice,
  WorkerAccountDto,
} from "@/lib/api/contracts";
import {
  formatChileanDateWithWeekday,
  formatChileanTabDate,
} from "@/lib/date-format";
import { isTrainingRegistrationOpen } from "@/lib/business-rules";
import { formatRefreshTime, useAutoRefresh } from "@/hooks/use-auto-refresh";

type Mode = "training" | "extra" | "special";
type View = "operations" | "summary" | "reports" | "workers";
type PreparationItem = { key: string; menuOptionId: string; quantity: string };

const modes = [
  {
    value: "training",
    label: "Capacitación",
    schedule: "Hasta 09:00 · desde 14:00 solo futuras",
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
  {
    value: "special",
    label: "Colación especial",
    schedule: "Hasta las 11:00",
    description: "Solicita una preparación fuera del menú. Requiere aprobación de la proveedora.",
    icon: Sparkles,
  },
] as const;

export function CompanyOperationsClient({
  menu: initialMenu,
  initialOperations,
  initialReport,
  nowIso,
  initialSummary,
  initialWorkers,
  initialView,
}: {
  menu: MenuWeekDto | null;
  initialOperations: CompanyOperationsDto | null;
  initialReport: OrdersReportDto;
  nowIso: string;
  initialSummary: DailySummaryDto | null;
  initialWorkers: WorkerAccountDto[];
  initialView?: View;
}) {
  const currentDate = localDate(new Date(nowIso));
  const initialDayId =
    initialMenu?.days.find((day) => day.serviceDate === currentDate)?.id ??
    initialMenu?.days.find((day) => !day.disabled)?.id ??
    initialMenu?.days[0]?.id ??
    "";
  const [menu, setMenu] = useState(initialMenu);
  const [operations, setOperations] = useState(initialOperations);
  const [activeDayId, setActiveDayId] = useState(initialDayId);
  const [mode, setMode] = useState<Mode>("training");
  const [trainingItems, setTrainingItems] = useState<PreparationItem[]>([
    { key: "training-initial", menuOptionId: "", quantity: "1" },
  ]);
  const [extraItems, setExtraItems] = useState<PreparationItem[]>([
    { key: "extra-initial", menuOptionId: "", quantity: "1" },
  ]);
  const [view, setView] = useState<View>(initialView ?? "operations");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date(nowIso).getTime());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshOperations = useCallback(async () => {
    const [nextMenu, nextOperations] = await Promise.all([
      browserApiRequest<MenuWeekDto>("/api/v1/menus/current"),
      browserApiRequest<CompanyOperationsDto>("/api/v1/company/operations"),
    ]);
    setMenu(nextMenu);
    setOperations(nextOperations);
    setActiveDayId((current) => {
      if (nextMenu.days.some((day) => day.id === current)) return current;
      const today = localDate(new Date());
      return (
        nextMenu.days.find((day) => day.serviceDate === today)?.id ??
        nextMenu.days.find((day) => !day.disabled)?.id ??
        nextMenu.days[0]?.id ??
        ""
      );
    });
  }, []);
  const { lastUpdatedAt, refreshError, refreshing, refreshNow } = useAutoRefresh(
    refreshOperations,
    { enabled: view === "operations" && !saving },
  );

  const activeDay = menu?.days.find((day) => day.id === activeDayId);
  const orders = operations?.orders ?? [];
  const activeOrders = orders.filter(
    (order) => order.serviceDayId === activeDayId && order.status === "confirmed",
  );
  const activeExceptions = (operations?.extraRequests ?? []).filter(
    (item) => item.serviceDayId === activeDayId,
  );
  const editableMenuOptions =
    activeDay?.options.filter((option) => option.visible && option.availableForWorkers) ?? [];
  const trainingMenus = activeDay?.options.filter(
    (option) => option.trainingMenu && option.visible,
  ) ?? [];
  const extraHasAvailability = editableMenuOptions.some(
    (option) => option.remainingQuantity === null || option.remainingQuantity > 0,
  );
  const trainingMenu = trainingMenus[0];
  const trainingHasAvailability = trainingMenus.some(
    (option) => typeof option.remainingQuantity === "number" && option.remainingQuantity > 0,
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
      trainingHasAvailability,
  );
  const extraOpen = Boolean(
    activeDay &&
      !activeDay.disabled &&
      !blocked &&
      extraHasAvailability &&
      now >= new Date(activeDay.sameDayOpensAt) &&
      now < new Date(activeDay.deliveryClosesAt),
  );
  const lateExtra = Boolean(activeDay && now >= new Date(activeDay.sameDayClosesAt));
  const specialOpen = Boolean(
    activeDay &&
      !activeDay.disabled &&
      !blocked &&
      now < new Date(activeDay.sameDayClosesAt),
  );
  const modeOpen = mode === "training" ? trainingOpen : mode === "extra" ? extraOpen : specialOpen;
  const modeClosedReason =
    mode === "training"
      ? trainingClosedMessage({
          blocked: blocked || Boolean(activeDay?.disabled),
          trainingMenu,
          remainingQuantity: trainingMenus.reduce((sum, option) => sum + (option.remainingQuantity ?? 0), 0),
        })
      : mode === "special"
        ? blocked || activeDay?.disabled
          ? "No hay servicio habilitado para este día."
          : "El plazo para solicitar colaciones especiales terminó a las 11:00."
      : !extraHasAvailability && !blocked && !activeDay?.disabled
        ? "No quedan cupos de colaciones extra para este día."
        : closedWindowMessage(mode, blocked || Boolean(activeDay?.disabled));
  const selectedMode = modes.find((item) => item.value === mode) ?? modes[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeDay || !modeOpen) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const complements = form.getAll("complement").map(String);
    if (mode === "extra" && complements.length === 0) {
      setError("Selecciona pan, té o ambos.");
      return;
    }
    let items: Array<{ menuOptionId: string; quantity: number }> = [];
    if (mode !== "special") {
      const availableOptions = mode === "training" ? trainingMenus : editableMenuOptions;
      const selectedItems = mode === "training" ? trainingItems : extraItems;
      items = selectedItems.map((item) => ({
        menuOptionId: item.menuOptionId || availableOptions.find((option) => option.remainingQuantity !== 0)?.id || "",
        quantity: Number(item.quantity),
      }));
      if (items.length === 0 || items.some((item) => {
        const option = availableOptions.find((candidate) => candidate.id === item.menuOptionId);
        return !option || !Number.isInteger(item.quantity) || item.quantity < 1 ||
          item.quantity > Math.min(500, option.remainingQuantity ?? 500);
      }) || new Set(items.map((item) => item.menuOptionId)).size !== items.length) {
        setError("Selecciona preparaciones distintas y cantidades dentro de sus cupos disponibles.");
        return;
      }
    } else {
      const quantity = Number(form.get("quantity"));
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
        setError("Ingresa entre 1 y 500 colaciones especiales.");
        return;
      }
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (mode === "training") {
        const name = String(form.get("name"));
        await browserApiRequest(
          "/api/v1/company/training-sessions/batch",
          {
            method: "POST",
            body: JSON.stringify({ serviceDayId: activeDay.id, name, items, tea: form.has("trainingTea") }),
          },
        );
      } else if (mode === "extra") {
        await browserApiRequest("/api/v1/company/extras/batch", {
          method: "POST",
          body: JSON.stringify({
            serviceDayId: activeDay.id,
            items,
            side: String(form.get("side")) as SideChoice,
            bread: complements.includes("bread"),
            tea: complements.includes("tea"),
            beneficiaryLabel: String(form.get("name")),
            ...(lateExtra ? { reason: String(form.get("reason")) } : {}),
          }),
        });
      } else {
        await browserApiRequest("/api/v1/company/special-requests", {
          method: "POST",
          body: JSON.stringify({
            serviceDayId: activeDay.id,
            beneficiaryLabel: String(form.get("name")),
            quantity: Number(form.get("quantity")),
            preparation: String(form.get("preparation")),
            reason: String(form.get("reason")),
          }),
        });
      }
      await refreshOperations();
      formElement.reset();
      setTrainingItems([{ key: crypto.randomUUID(), menuOptionId: "", quantity: "1" }]);
      setExtraItems([{ key: crypto.randomUUID(), menuOptionId: "", quantity: "1" }]);
      setMessage(
        mode === "special"
          ? "Solicitud especial enviada a la proveedora."
          : mode === "extra" && lateExtra
          ? "Solicitud de colación extra enviada a la proveedora."
          : "Colaciones agregadas correctamente.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible guardar");
    } finally {
      setSaving(false);
    }
  }

  async function refreshAfterCorrection() {
    await refreshOperations();
  }

  function showCorrectionSuccess(successMessage: string) {
    setError("");
    setMessage(successMessage);
  }

  function showCorrectionError(errorMessage: string) {
    setMessage("");
    setError(errorMessage);
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
          {view === "operations" ? (
            <button
              type="button"
              onClick={() => void refreshNow()}
              disabled={refreshing || saving}
              className="company-action inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 text-xs font-extrabold disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Actualizando…" : "Actualizar"}
            </button>
          ) : null}
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

      {view === "operations" ? (
        <p role="status" className="mt-3 text-xs font-bold text-[var(--muted)]">
          {refreshError || formatRefreshTime(lastUpdatedAt)}
        </p>
      ) : null}

      {view === "summary" ? (
        <div className="mt-7"><DailySummary initialSummary={initialSummary} viewerRole="company_admin" /></div>
      ) : view === "workers" ? (
        <WorkerManagement initialWorkers={initialWorkers} />
      ) : view === "reports" ? (
        <OperationsReports
          endpoint="/api/v1/company/reports"
          initialReport={initialReport}
          sectioned
        />
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
                  setTrainingItems([{ key: crypto.randomUUID(), menuOptionId: "", quantity: "1" }]);
                  setExtraItems([{ key: crypto.randomUUID(), menuOptionId: "", quantity: "1" }]);
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
              label="Solicitudes pendientes"
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

              <div className="company-mode-grid mt-5 grid gap-3 sm:grid-cols-3">
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
                    <strong>{modeOpen ? "Registro habilitado" : "Registro no disponible"}</strong>
                    <p className="mt-0.5 text-xs font-semibold opacity-80">
                      {modeOpen
                        ? selectedMode.description
                        : modeClosedReason}
                    </p>
                  </div>
                </div>

                <form
                  key={`${activeDayId}-${mode}`}
                  onSubmit={submit}
                  className="mt-5 space-y-4"
                >
                  <Field label={mode === "training" ? "Nombre de la capacitación" : mode === "special" ? "Persona beneficiaria" : "Persona o referencia"}>
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={120}
                      disabled={!modeOpen || saving}
                      placeholder={
                        mode === "training" ? "Ej.: Inducción nuevos guardias" : mode === "special" ? "Ej.: Gerente general" : "Ej.: Visita externa"
                      }
                      className="company-input form-control px-4"
                    />
                  </Field>

                  {mode !== "special" ? (
                    <PreparationSelector
                      label={mode === "training" ? "Preparaciones de capacitación" : "Menús solicitados"}
                      options={mode === "training" ? trainingMenus : editableMenuOptions}
                      items={mode === "training" ? trainingItems : extraItems}
                      onChange={mode === "training" ? setTrainingItems : setExtraItems}
                      disabled={!modeOpen || saving}
                    />
                  ) : (
                    <>
                      <Field label="Cantidad">
                        <input
                          name="quantity"
                          type="number"
                          min={1}
                          max={500}
                          defaultValue={1}
                          required
                          disabled={!modeOpen || saving}
                          className="company-input form-control px-4"
                        />
                      </Field>
                      <Field label="Preparación solicitada">
                        <textarea
                          name="preparation"
                          required
                          minLength={3}
                          maxLength={300}
                          rows={3}
                          disabled={!modeOpen || saving}
                          placeholder="Describe la comida solicitada fuera del menú"
                          className="company-input form-control p-4"
                        />
                      </Field>
                      <Field label="Motivo u observación">
                        <textarea
                          name="reason"
                          required
                          minLength={5}
                          maxLength={500}
                          rows={3}
                          disabled={!modeOpen || saving}
                          placeholder="Indica por qué se necesita esta colación especial"
                          className="company-input form-control p-4"
                        />
                      </Field>
                    </>
                  )}

                  {mode === "training" ? (
                    <div className="rounded-xl bg-[var(--herb-soft)] p-4 text-sm">
                      <p className="font-extrabold">Incluido para cada alumno</p>
                      <p className="mt-1 text-[var(--muted)]">Almuerzo, ensalada, fruta, jugo y pan.</p>
                      <p className="mt-2 font-bold">{trainingItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)} de cada uno en el conteo.</p>
                      <label className="mt-3 flex items-center gap-2 font-bold">
                        <input name="trainingTea" type="checkbox" className="accent-[var(--brand)]" />
                        Agregar té para todos los alumnos (opcional)
                      </label>
                    </div>
                  ) : mode === "extra" ? (
                    <>
                      <Field label="Acompañamiento">
                        <FormSelect
                          name="side"
                          required
                          ariaLabel="Acompañamiento"
                          defaultValue="ensalada"
                          options={[
                            { value: "ensalada", label: "Ensalada" },
                            { value: "fruta", label: "Fruta" },
                          ]}
                          className="company-input text-sm font-semibold"
                        />
                      </Field>

                      <fieldset>
                        <legend className="text-sm font-extrabold">Complementos</legend>
                        <p className="mt-1 text-xs text-[var(--muted)]">Selecciona pan, té o ambos.</p>
                        <div className="mt-2 grid grid-cols-2 gap-3">
                          {[["bread", "Pan"], ["tea", "Té"]].map(([value, label]) => (
                            <label key={value} className="company-choice cursor-pointer rounded-xl border border-[var(--line)] bg-white p-3 font-bold">
                              <input name="complement" type="checkbox" value={value} className="mr-2 accent-[var(--brand)]" />
                              {label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </>
                  ) : null}

                  {mode === "extra" && lateExtra ? (
                    <Field label="Motivo de la solicitud tardía">
                      <textarea
                        name="reason"
                        required
                        minLength={5}
                        rows={3}
                        placeholder="Explica por qué se necesita después de las 11:00"
                        className="company-input form-control p-4"
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
                      : mode === "special"
                        ? "Enviar solicitud especial"
                        : mode === "extra" && lateExtra
                          ? "Enviar solicitud"
                          : "Agregar al conteo"}
                  </button>
                </form>

                <SuccessDialog message={message || null} onClose={() => setMessage("")} />
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
                  <div>
                    <p className="eyebrow">Correcciones</p>
                    <h2 className="mt-1 font-black">Registros creados</h2>
                  </div>
                  <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-extrabold">
                    {activeOrders.length}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                  Puedes corregirlos o eliminarlos mientras la entrega del día no haya terminado.
                </p>
                <div className="company-list-enter mt-4 space-y-3">
                  {activeOrders.length ? (
                    activeOrders.map((order) => {
                      const option = activeDay?.options.find(
                        (item) => item.id === order.menuOptionId,
                      );
                      const specialRequest = order.exceptionRequestId
                        ? activeExceptions.find((item) => item.id === order.exceptionRequestId)
                        : undefined;
                      return (
                        <article
                          key={order.id}
                          className="company-list-item rounded-xl border border-[var(--line)] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-xs font-black uppercase tracking-wide text-[var(--brand)]">
                                {order.kind === "training"
                                  ? "Capacitación"
                                  : order.kind === "special"
                                    ? "Colación especial"
                                    : "Colación extra"}
                              </span>
                              <strong className="mt-1 block break-words">
                                {order.beneficiaryLabel || "Sin referencia"}
                              </strong>
                            </div>
                            {order.kind !== "special" ? (
                              <OperationalOrderActions
                                order={order}
                                menuOptions={editableMenuOptions}
                                trainingMenu={trainingMenu}
                                onChanged={refreshAfterCorrection}
                                onBusyChange={setSaving}
                                onSuccess={showCorrectionSuccess}
                                onError={showCorrectionError}
                              />
                            ) : null}
                          </div>
                          <dl className="mt-3 grid gap-1.5 text-xs text-[var(--muted)]">
                            <div className="flex justify-between gap-3">
                              <dt>Menú</dt>
                              <dd className="text-right font-bold text-[var(--ink)]">
                                {option?.description ?? specialRequest?.specialPreparation ?? "Sin detalle"}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt>Cantidad</dt>
                              <dd className="font-bold text-[var(--ink)]">{order.quantity}</dd>
                            </div>
                            {order.kind !== "special" ? (
                              <div className="flex justify-between gap-3">
                                <dt>Selección</dt>
                                <dd className="text-right font-bold text-[var(--ink)]">
                                  {order.trainingPackage
                                    ? `Ensalada · Fruta · Jugo · Pan${order.tea ? " · Té" : ""}`
                                    : `${sideLabel(order.side)} · ${complementLabel(order)}`}
                                </dd>
                              </div>
                            ) : null}
                          </dl>
                        </article>
                      );
                    })
                  ) : (
                    <EmptyState text="Todavía no hay capacitaciones, extras ni especiales para este día." />
                  )}
                </div>
              </section>

              <section className="company-card-motion card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-black">Solicitudes especiales y tardías</h2>
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
                            <span className="text-xs font-black uppercase tracking-wide text-[var(--brand)]">
                              {item.requestKind === "special" ? "Colación especial" : "Extra tardía"}
                            </span>
                            <strong className="mt-1 block">{item.beneficiaryLabel}</strong>
                            <p className="mt-1 text-xs font-bold">{item.quantity} colaciones</p>
                            {item.specialPreparation ? (
                              <p className="mt-1 text-sm font-bold text-[var(--ink)]">
                                {item.specialPreparation}
                              </p>
                            ) : null}
                            <p className="mt-1 text-xs text-[var(--muted)]">{item.reason}</p>
                          </div>
                          <StatusBadge status={item.status} />
                        </div>
                        {item.resolutionNote ? (
                          <p className="mt-3 rounded-lg bg-[var(--surface-muted)] p-2 text-xs text-[var(--muted)]">
                            {item.resolutionNote}
                          </p>
                        ) : null}
                        {item.requestKind === "late_extra" && item.status !== "approved" ? (
                          <ExtraRequestActions
                            request={item}
                            menuOptions={editableMenuOptions}
                            onChanged={refreshAfterCorrection}
                            onBusyChange={setSaving}
                            onSuccess={showCorrectionSuccess}
                            onError={showCorrectionError}
                          />
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <EmptyState text="Sin solicitudes para este día." />
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

function PreparationSelector({
  label,
  options,
  items,
  onChange,
  disabled,
}: {
  label: string;
  options: MenuWeekDto["days"][number]["options"];
  items: PreparationItem[];
  onChange: (items: PreparationItem[]) => void;
  disabled: boolean;
}) {
  const selectedIds = items.map((item, index) => {
    const selected = options.find((option) => option.id === item.menuOptionId);
    if (selected) return selected.id;
    const used = items.slice(0, index).map((previous) => previous.menuOptionId);
    return options.find((option) => option.remainingQuantity !== 0 && !used.includes(option.id))?.id ?? "";
  });
  const availableToAdd = options.find((option) =>
    option.remainingQuantity !== 0 && !selectedIds.includes(option.id),
  );

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-extrabold">{label}</legend>
      {items.map((item, index) => {
        const selectedId = selectedIds[index];
        const selectedOption = options.find((option) => option.id === selectedId);
        return (
          <div key={item.key} className="rounded-xl border border-[var(--line)] bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-extrabold">Preparación {index + 1}</p>
              {items.length > 1 ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(items.filter((candidate) => candidate.key !== item.key))}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-red-50 px-2 text-xs font-bold text-[var(--danger)] disabled:opacity-40"
                ><Trash2 size={14} /> Quitar</button>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <label className="block text-xs font-extrabold">Menú
                <FormSelect
                  value={selectedId || undefined}
                  onValueChange={(value) => onChange(items.map((candidate) => candidate.key === item.key ? { ...candidate, menuOptionId: value } : candidate))}
                  ariaLabel={`Menú de preparación ${index + 1}`}
                  options={options.map((option) => ({
                    value: option.id,
                    label: `${option.label} · ${option.description}${option.remainingQuantity === null ? "" : ` · ${option.remainingQuantity} disponibles`}`,
                    disabled: option.remainingQuantity === 0 || selectedIds.some((id, itemIndex) => itemIndex !== index && id === option.id),
                  }))}
                  disabled={disabled}
                  className="company-input mt-2 text-sm font-semibold"
                />
              </label>
              <label className="block text-xs font-extrabold">Cantidad
                <input
                  type="number"
                  min="1"
                  max={Math.min(500, selectedOption?.remainingQuantity ?? 500)}
                  value={item.quantity}
                  onChange={(event) => onChange(items.map((candidate) => candidate.key === item.key ? { ...candidate, quantity: event.target.value } : candidate))}
                  disabled={disabled || !selectedOption}
                  required
                  className="company-input form-control mt-2 px-3"
                />
              </label>
            </div>
            <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
              {selectedOption
                ? selectedOption.remainingQuantity === null
                  ? "Cupo diario no informado."
                  : `${selectedOption.remainingQuantity} disponibles de ${selectedOption.capacity} para este día.`
                : "No hay preparaciones disponibles para este día."}
            </p>
          </div>
        );
      })}
      <button
        type="button"
        disabled={disabled || !availableToAdd || items.length >= 10}
        onClick={() => availableToAdd && onChange([...items, { key: crypto.randomUUID(), menuOptionId: availableToAdd.id, quantity: "1" }])}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--brand)] px-4 text-sm font-extrabold text-[var(--brand)] disabled:opacity-40"
      ><Plus size={17} /> Agregar otra preparación</button>
    </fieldset>
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

function sideLabel(side: SideChoice) {
  return {
    ensalada: "Ensalada",
    fruta: "Fruta",
    postre: "Postre",
    ninguno: "Ninguno",
  }[side];
}

function complementLabel(order: { bread: boolean; tea: boolean }) {
  if (order.bread && order.tea) return "Pan y té";
  if (order.bread) return "Pan";
  if (order.tea) return "Té";
  return "Sin complemento";
}

function closedWindowMessage(mode: Mode, blocked: boolean) {
  if (blocked) return "La fecha está bloqueada por feriado, vacaciones o día sin servicio.";
  if (mode === "training") {
    return "Hasta las 09:00 puedes registrar capacitaciones para hoy o fechas futuras. Desde las 14:00, solo para fechas futuras.";
  }
  return "Las colaciones extra abren a las 08:00 y cierran por completo a las 13:00.";
}

function trainingClosedMessage({
  blocked,
  trainingMenu,
  remainingQuantity,
}: {
  blocked: boolean;
  trainingMenu: MenuWeekDto["days"][number]["options"][number] | undefined;
  remainingQuantity: number | null | undefined;
}) {
  if (blocked) return "La fecha está bloqueada o fue marcada sin servicio.";
  if (!trainingMenu) {
    return "La proveedora todavía no ha definido el menú de capacitación para este día.";
  }
  if (trainingMenu.capacity === null || typeof remainingQuantity !== "number") {
    return "La proveedora todavía no ha informado el cupo diario de capacitación.";
  }
  if (remainingQuantity <= 0) {
    return "No quedan cupos de capacitación para este día.";
  }
  return closedWindowMessage("training", false);
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
