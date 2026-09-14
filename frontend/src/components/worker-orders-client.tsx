"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  Coffee,
  Salad,
  Trash2,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import { browserApiRequest } from "@/lib/api/client";
import { WorkerWeekSelector } from "@/components/worker-week-selector";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SuccessDialog } from "@/components/ui/success-dialog";
import type {
  MenuOptionDto,
  OrderDto,
  ServiceDayDto,
  SideChoice,
  WorkerMenuWeekSummaryDto,
  WorkerOrdersDto,
} from "@/lib/api/contracts";
import {
  formatChileanDate,
  formatChileanDateTime,
  formatChileanDateWithWeekday,
  formatChileanTabDate,
} from "@/lib/date-format";

interface Draft {
  menuOptionId: string;
  side: SideChoice | "";
  bread: boolean;
  tea: boolean;
}

const emptyDraft: Draft = {
  menuOptionId: "",
  side: "",
  bread: false,
  tea: false,
};

interface WorkerOrdersClientProps {
  userName: string;
  initialData: WorkerOrdersDto;
  nowIso: string;
  currentStartsOn: string;
  publishedWeeks: WorkerMenuWeekSummaryDto[];
}

export function WorkerOrdersClient({
  userName,
  initialData,
  nowIso,
  currentStartsOn,
  publishedWeeks,
}: WorkerOrdersClientProps) {
  const initialDayId = getInitialDayId(initialData, nowIso);
  const [orders, setOrders] = useState(initialData.orders);
  const [remainingByOption, setRemainingByOption] = useState<Record<string, number | null>>(
    () => availabilityFromMenu(initialData),
  );
  const [activeDayId, setActiveDayId] = useState(initialDayId);
  const [draft, setDraft] = useState<Draft>(() =>
    draftForDay(
      initialData.orders,
      initialData.menuWeek.days.find((day) => day.id === initialDayId),
    ),
  );
  const [currentTime, setCurrentTime] = useState(() => new Date(nowIso).getTime());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      setCurrentTime(Date.now());
      try {
        const latest = await browserApiRequest<WorkerOrdersDto>(
          `/api/v1/orders/me?startsOn=${initialData.menuWeek.startsOn}`,
        );
        if (!active) return;
        setOrders(latest.orders);
        setRemainingByOption(availabilityFromMenu(latest));
      } catch {
        // La validación final de cupos permanece en la base de datos.
      }
    };
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [initialData.menuWeek.startsOn]);

  const activeDay = initialData.menuWeek.days.find((day) => day.id === activeDayId);
  const existingOrder = getConfirmedOrder(orders, activeDayId);
  const workerOptions = activeDay?.options.filter(
    (option) => option.visible && option.availableForWorkers,
  ) ?? [];
  const selectedOption = workerOptions.find((option) => option.id === draft.menuOptionId);
  const selectedOptionAvailable = Boolean(
    selectedOption &&
      isOptionSelectable(
        remainingByOption[selectedOption.id] ?? selectedOption.remainingQuantity,
        existingOrder?.menuOptionId === selectedOption.id,
      ),
  );
  const canReserve = Boolean(
    activeDay &&
      !activeDay.disabled &&
      workerOptions.length > 0 &&
      currentTime <= new Date(activeDay.preorderDeadline).getTime(),
  );
  const formComplete = Boolean(
    draft.menuOptionId && draft.side && draft.bread !== draft.tea && selectedOptionAvailable,
  );
  const serviceDays = initialData.menuWeek.days.filter((day) => !day.disabled);
  const reservedDays = serviceDays.filter((day) => getConfirmedOrder(orders, day.id)).length;

  function openDay(dayId: string) {
    setActiveDayId(dayId);
    setDraft(
      draftForDay(
        orders,
        initialData.menuWeek.days.find((day) => day.id === dayId),
      ),
    );
    setMessage("");
    setError("");
  }

  function updateDraft(update: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...update }));
    setMessage("");
    setError("");
  }

  async function saveOrder() {
    if (!activeDay || !canReserve || !formComplete || !draft.side) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const saved = await browserApiRequest<OrderDto>("/api/v1/orders/me", {
        method: "PUT",
        body: JSON.stringify({
          serviceDayId: activeDay.id,
          menuOptionId: draft.menuOptionId,
          side: draft.side,
          bread: draft.bread,
          tea: draft.tea,
        }),
      });

      setOrders((current) => [
        ...current.filter((order) => order.serviceDayId !== activeDay.id),
        saved,
      ]);
      setRemainingByOption((current) => {
        const next = { ...current };
        if (existingOrder?.menuOptionId !== saved.menuOptionId) {
          if (existingOrder) {
            next[existingOrder.menuOptionId] = incrementRemaining(
              next[existingOrder.menuOptionId],
            );
          }
          next[saved.menuOptionId] = decrementRemaining(next[saved.menuOptionId]);
        }
        return next;
      });
      setMessage(
        existingOrder
          ? `Tu almuerzo del ${formatChileanDate(activeDay.serviceDate)} fue actualizado.`
          : `Tu almuerzo del ${formatChileanDate(activeDay.serviceDate)} quedó reservado.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible guardar tu solicitud.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancelOrder() {
    if (!existingOrder || !activeDay || !canReserve) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await browserApiRequest<OrderDto>(
        `/api/v1/orders/me/${existingOrder.id}`,
        { method: "DELETE" },
      );
      setOrders((current) => current.filter((order) => order.id !== existingOrder.id));
      setRemainingByOption((current) => ({
        ...current,
        [existingOrder.menuOptionId]: incrementRemaining(
          current[existingOrder.menuOptionId],
        ),
      }));
      setDraft(emptyDraft);
      setMessage(`Tu almuerzo del ${formatChileanDate(activeDay.serviceDate)} fue eliminado.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No fue posible eliminar tu solicitud.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!activeDay) return null;

  return (
    <main className="page-shell provider-shell-enter">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow">Solicitud semanal</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Elige tus almuerzos</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Semana del {formatChileanDate(initialData.menuWeek.startsOn)}. Puedes
            reservar uno o varios días.
          </p>
        </div>
        <span className="card flex max-w-full min-w-0 items-center gap-3 px-4 py-3 text-sm font-bold">
          <UserRound size={18} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{userName}</span>
        </span>
      </header>

      <div className="mt-7">
        <WorkerWeekSelector
          currentStartsOn={currentStartsOn}
          selectedStartsOn={initialData.menuWeek.startsOn}
          publishedWeeks={publishedWeeks}
        />
      </div>

      <section className="mt-5 rounded-2xl border border-[var(--line)] bg-white/75 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold">Tu semana</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {reservedDays} de {serviceDays.length} días con almuerzo reservado
            </p>
          </div>
          {reservedDays === serviceDays.length && serviceDays.length > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--herb-soft)] px-3 py-2 text-xs font-extrabold text-[var(--herb-strong)]">
              <CheckCircle2 size={16} aria-hidden="true" /> Semana completa
            </span>
          ) : null}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="h-full rounded-full bg-[var(--herb)] transition-[width] duration-500"
            style={{
              width: serviceDays.length
                ? `${Math.round((reservedDays / serviceDays.length) * 100)}%`
                : "0%",
            }}
          />
        </div>
      </section>

      <div
        className="mobile-scroll-tabs mt-5 flex gap-2 overflow-x-auto pb-2"
        role="tablist"
        aria-label="Días de la semana"
      >
        {initialData.menuWeek.days.map((day) => {
          const status = getDayStatus(day, orders, currentTime);
          const selected = day.id === activeDayId;

          return (
            <button
              key={day.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="worker-order-panel"
              onClick={() => openDay(day.id)}
              className={`focus-ring min-w-32 snap-start rounded-2xl border px-3 py-3 text-left transition duration-200 sm:min-w-36 sm:px-4 ${
                selected
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white shadow-md"
                  : "border-[var(--line)] bg-white hover:-translate-y-0.5 hover:border-[var(--brand)]"
              }`}
            >
              <span className="block text-sm font-extrabold">
                {formatChileanTabDate(day.serviceDate)}
              </span>
              <span
                className={`mt-1 flex items-center gap-1.5 text-xs font-bold ${
                  selected ? "text-white/85" : status.className
                }`}
              >
                {status.icon}
                {status.label}
              </span>
            </button>
          );
        })}
      </div>

      <section
        id="worker-order-panel"
        role="tabpanel"
        className="mt-3"
        aria-label={formatChileanDateWithWeekday(activeDay.serviceDate)}
      >
        <BookingNotice day={activeDay} canReserve={canReserve} />

        {!activeDay.disabled && workerOptions.length > 0 ? (
          <OrderProgress draft={draft} existingOrder={Boolean(existingOrder)} />
        ) : null}

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="card p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Paso 1</p>
                <h2 className="mt-1 text-xl font-black">
                  {formatChileanDateWithWeekday(activeDay.serviceDate)}
                </h2>
              </div>
              {existingOrder ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--herb-soft)] px-3 py-2 text-xs font-extrabold text-[var(--herb-strong)]">
                  <Check size={15} aria-hidden="true" /> Reservado
                </span>
              ) : null}
            </div>

            {activeDay.disabled ? (
              <EmptyMenu message="Este día no habrá servicio de colaciones." />
            ) : workerOptions.length === 0 ? (
              <EmptyMenu message="Todavía no hay preparaciones disponibles para este día." />
            ) : (
              <fieldset className="mt-5 space-y-3">
                <legend className="mb-4 font-extrabold">Selecciona una preparación</legend>
                {workerOptions.map((option) => (
                  <MenuOptionCard
                    key={option.id}
                    option={option}
                    selected={draft.menuOptionId === option.id}
                    remainingQuantity={
                      remainingByOption[option.id] ?? option.remainingQuantity
                    }
                    hasOwnReservation={existingOrder?.menuOptionId === option.id}
                    disabled={
                      !canReserve ||
                      !isOptionSelectable(
                        remainingByOption[option.id] ?? option.remainingQuantity,
                        existingOrder?.menuOptionId === option.id,
                      )
                    }
                    onSelect={() => updateDraft({ menuOptionId: option.id })}
                  />
                ))}
              </fieldset>
            )}
          </section>

          <aside className="space-y-5">
            <section className="card p-5">
              <p className="eyebrow">Paso 2</p>
              <h2 className="mt-1 flex items-center gap-2 font-extrabold">
                <Salad size={20} aria-hidden="true" /> Acompañamiento
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Elige sólo una opción. La fruta reemplaza a la ensalada.
              </p>
              <div className={`mt-4 grid gap-2 ${isWednesday(activeDay.serviceDate) ? "grid-cols-3" : "grid-cols-2"}`}>
                {getSideChoices(activeDay.serviceDate).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={!canReserve}
                    onClick={() => updateDraft({ side: value })}
                    className={`focus-ring min-h-14 rounded-xl border px-2 text-xs font-bold transition ${
                      draft.side === value
                        ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                        : "border-[var(--line)] bg-white hover:border-[var(--brand)]"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section className="card p-5">
              <p className="eyebrow">Paso 3</p>
              <h2 className="mt-1 flex items-center gap-2 font-extrabold">
                <Coffee size={20} aria-hidden="true" /> Pan o té
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(
                  [
                    ["bread", "Pan"],
                    ["tea", "Té"],
                  ] as const
                ).map(([field, label]) => {
                  const checked = field === "bread" ? draft.bread : draft.tea;
                  return (
                    <label
                      key={field}
                      className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 font-bold transition ${
                        checked
                          ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                          : "border-[var(--line)]"
                      } ${canReserve ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                    >
                      <input
                        type="radio"
                        name="complement"
                        disabled={!canReserve}
                        checked={checked}
                        onChange={() =>
                          updateDraft({
                            bread: field === "bread",
                            tea: field === "tea",
                          })
                        }
                        className="size-4 accent-[var(--brand)]"
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </section>

            <OrderReview
              selectedOption={selectedOption}
              draft={draft}
              existingOrder={Boolean(existingOrder)}
            />

            <button
              type="button"
              onClick={saveOrder}
              disabled={!canReserve || saving || !formComplete}
              className="focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            >
              <CheckCircle2 size={18} aria-hidden="true" />
              {saving
                ? "Guardando…"
                : existingOrder
                  ? "Guardar cambios"
                  : "Confirmar almuerzo"}
            </button>

            {existingOrder ? (
              <ConfirmDialog
                title="¿Eliminar este almuerzo?"
                description={`Se eliminará tu reserva del ${formatChileanDate(activeDay.serviceDate)} y el cupo volverá a quedar disponible.`}
                confirmLabel="Sí, eliminar"
                tone="danger"
                onConfirm={cancelOrder}
                trigger={
                  <button
                    type="button"
                    disabled={saving || !canReserve}
                    className="focus-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-xl font-bold text-[var(--danger)] transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 size={16} aria-hidden="true" /> Eliminar almuerzo
                  </button>
                }
              />
            ) : null}

            <div aria-live="polite">
              <SuccessDialog message={message || null} onClose={() => setMessage("")} />
              {error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]"
                >
                  {error}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function OrderProgress({
  draft,
  existingOrder,
}: {
  draft: Draft;
  existingOrder: boolean;
}) {
  const steps = [
    { label: "Preparación", complete: Boolean(draft.menuOptionId) },
    { label: "Acompañamiento", complete: Boolean(draft.side) },
    { label: "Pan o té", complete: draft.bread !== draft.tea },
  ];
  const completedSteps = steps.filter((step) => step.complete).length;
  const percentage = Math.round((completedSteps / steps.length) * 100);
  const guidance = getProgressGuidance(steps, existingOrder);

  return (
    <section className="mt-5 rounded-2xl border border-[var(--line)] bg-white/80 p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold">Progreso de tu solicitud</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{guidance}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--brand)]">
          {completedSteps} de {steps.length}
        </span>
      </div>

      <div
        className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--line)]"
        role="progressbar"
        aria-label="Progreso de la solicitud de colación"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={completedSteps}
        aria-valuetext={`${completedSteps} de ${steps.length} pasos completados`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--accent)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Pasos de la solicitud">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={`flex min-w-0 items-center gap-2 text-[0.68rem] font-bold sm:text-xs ${
              step.complete ? "text-[var(--herb-strong)]" : "text-[var(--muted)]"
            }`}
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-black transition-colors duration-300 ${
                step.complete
                  ? "border-[var(--herb)] bg-[var(--herb)] text-white"
                  : "border-[var(--line)] bg-white"
              }`}
              aria-hidden="true"
            >
              {step.complete ? <Check size={12} strokeWidth={3} /> : index + 1}
            </span>
            <span className="truncate">{step.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function getProgressGuidance(
  steps: Array<{ label: string; complete: boolean }>,
  existingOrder: boolean,
) {
  if (steps.every((step) => step.complete)) {
    return existingOrder
      ? "Tu almuerzo está completo. Puedes modificarlo y guardar los cambios."
      : "Todo listo. Confirma tu almuerzo para reservarlo.";
  }

  const nextStep = steps.find((step) => !step.complete);
  return `Siguiente: elige ${nextStep?.label.toLocaleLowerCase("es-CL")}.`;
}

function BookingNotice({ day, canReserve }: { day: ServiceDayDto; canReserve: boolean }) {
  return (
    <div
      className={`flex gap-3 rounded-2xl border p-4 ${
        canReserve
          ? "border-[var(--herb)]/25 bg-[var(--herb-soft)] text-[var(--herb-strong)]"
          : "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--warning)]"
      }`}
    >
      <Clock3 size={19} className="shrink-0" aria-hidden="true" />
      <p className="text-sm">
        <strong className="block">
          {canReserve
            ? "Solicitud disponible"
            : day.disabled
              ? "Día sin servicio"
              : "Solicitud cerrada"}
        </strong>
        {canReserve
          ? `Puedes reservar o modificar hasta el ${formatChileanDateTime(day.preorderDeadline)}.`
          : day.disabled
            ? "No se reciben solicitudes para esta fecha."
            : `El plazo terminó el ${formatChileanDateTime(day.preorderDeadline)}.`}
      </p>
    </div>
  );
}

function MenuOptionCard({
  option,
  selected,
  remainingQuantity,
  hasOwnReservation,
  disabled,
  onSelect,
}: {
  option: MenuOptionDto;
  selected: boolean;
  remainingQuantity: number | null;
  hasOwnReservation: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex gap-4 rounded-2xl border p-4 transition ${
        selected
          ? "border-[var(--brand)] bg-[var(--brand-soft)]/70 shadow-sm"
          : "border-[var(--line)] bg-white hover:border-[var(--brand)]"
      } ${disabled ? "cursor-not-allowed opacity-65" : "cursor-pointer"}`}
    >
      <input
        type="radio"
        name="main"
        disabled={disabled}
        checked={selected}
        onChange={onSelect}
        className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="block text-xs font-extrabold uppercase tracking-wide text-[var(--brand)]">
            {option.label}
          </span>
          <AvailabilityBadge
            remainingQuantity={remainingQuantity}
            hasOwnReservation={hasOwnReservation}
          />
        </span>
        <span className="mt-1 block text-base font-bold">{option.description}</span>
        {remainingQuantity === 0 && !hasOwnReservation ? (
          <span className="mt-2 block text-sm font-bold text-[var(--danger)]">
            Selecciona otra opción disponible.
          </span>
        ) : null}
      </span>
    </label>
  );
}

function AvailabilityBadge({
  remainingQuantity,
  hasOwnReservation,
}: {
  remainingQuantity: number | null;
  hasOwnReservation: boolean;
}) {
  if (remainingQuantity === null) {
    return (
      <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-extrabold text-[var(--muted)]">
        Disponibilidad por confirmar
      </span>
    );
  }
  if (remainingQuantity === 0 && !hasOwnReservation) {
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-extrabold text-[var(--danger)]">
        Agotado
      </span>
    );
  }
  if (hasOwnReservation) {
    return (
      <span className="rounded-full bg-[var(--herb-soft)] px-2.5 py-1 text-xs font-extrabold text-[var(--herb-strong)]">
        Tu reserva · {remainingQuantity} libres
      </span>
    );
  }
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${
      remainingQuantity <= 5
        ? "bg-[var(--accent-soft)] text-[var(--warning)]"
        : "bg-[var(--herb-soft)] text-[var(--herb-strong)]"
    }`}>
      {remainingQuantity} disponibles
    </span>
  );
}

function OrderReview({
  selectedOption,
  draft,
  existingOrder,
}: {
  selectedOption: MenuOptionDto | undefined;
  draft: Draft;
  existingOrder: boolean;
}) {
  const side = draft.side
    ? {
        ensalada: "Ensalada",
        fruta: "Fruta",
        postre: "Postre",
        ninguno: "Sin acompañamiento",
      }[draft.side]
    : "Por elegir";
  const complement = draft.bread ? "Pan" : draft.tea ? "Té" : "Por elegir";

  return (
    <section className="rounded-2xl border border-dashed border-[var(--line)] bg-white/65 p-5">
      <p className="eyebrow">Resumen</p>
      <h2 className="mt-1 flex items-center gap-2 font-extrabold">
        <UtensilsCrossed size={18} aria-hidden="true" />
        {existingOrder ? "Tu reserva actual" : "Tu elección"}
      </h2>
      <dl className="mt-4 space-y-3 text-sm">
        <ReviewRow label="Preparación" value={selectedOption?.description ?? "Por elegir"} />
        <ReviewRow label="Acompañamiento" value={side} />
        <ReviewRow label="Complemento" value={complement} />
      </dl>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </div>
  );
}

function EmptyMenu({ message }: { message: string }) {
  return (
    <div className="mt-5 rounded-2xl bg-[var(--cream)] p-6 text-center">
      <UtensilsCrossed className="mx-auto text-[var(--muted)]" aria-hidden="true" />
      <p className="mt-3 text-sm font-bold text-[var(--muted)]">{message}</p>
    </div>
  );
}

function draftForDay(orders: OrderDto[], day: ServiceDayDto | undefined): Draft {
  if (!day) return emptyDraft;
  const order = getConfirmedOrder(orders, day.id);
  if (!order) return emptyDraft;
  const validSide =
    order.side === "ensalada" ||
    order.side === "fruta" ||
    (order.side === "postre" && isWednesday(day.serviceDate));
  return {
    menuOptionId: order.menuOptionId,
    side: validSide ? order.side : "",
    bread: order.bread,
    tea: order.tea,
  };
}

function getSideChoices(serviceDate: string) {
  const choices: Array<[Extract<SideChoice, "ensalada" | "fruta" | "postre">, string]> = [
    ["ensalada", "Ensalada"],
    ["fruta", "Fruta"],
  ];
  if (isWednesday(serviceDate)) choices.push(["postre", "Postre"]);
  return choices;
}

function isWednesday(serviceDate: string) {
  return new Date(`${serviceDate}T12:00:00.000Z`).getUTCDay() === 3;
}

function availabilityFromMenu(data: WorkerOrdersDto) {
  return Object.fromEntries(
    data.menuWeek.days.flatMap((day) =>
      day.options.map((option) => [option.id, option.remainingQuantity] as const),
    ),
  );
}

function isOptionSelectable(remaining: number | null, hasOwnReservation: boolean) {
  return remaining === null || remaining > 0 || hasOwnReservation;
}

function decrementRemaining(value: number | null | undefined) {
  return typeof value === "number" ? Math.max(0, value - 1) : null;
}

function incrementRemaining(value: number | null | undefined) {
  return typeof value === "number" ? value + 1 : null;
}

function getConfirmedOrder(orders: OrderDto[], dayId: string) {
  return orders.find(
    (order) => order.serviceDayId === dayId && order.status === "confirmed",
  );
}

function getInitialDayId(data: WorkerOrdersDto, nowIso: string) {
  const currentTime = new Date(nowIso).getTime();
  const days = data.menuWeek.days;
  const firstPending = days.find(
    (day) =>
      !day.disabled &&
      day.options.some((option) => option.visible && option.availableForWorkers) &&
      currentTime <= new Date(day.preorderDeadline).getTime() &&
      !getConfirmedOrder(data.orders, day.id),
  );
  const firstReserved = days.find((day) => getConfirmedOrder(data.orders, day.id));
  return firstPending?.id ?? firstReserved?.id ?? days[0]?.id ?? "";
}

function getDayStatus(day: ServiceDayDto, orders: OrderDto[], currentTime: number) {
  if (day.disabled) {
    return {
      label: "Sin servicio",
      className: "text-[var(--muted)]",
      icon: <span aria-hidden="true">—</span>,
    };
  }
  if (getConfirmedOrder(orders, day.id)) {
    return {
      label: "Reservado",
      className: "text-[var(--herb-strong)]",
      icon: <CheckCircle2 size={14} aria-hidden="true" />,
    };
  }
  if (currentTime > new Date(day.preorderDeadline).getTime()) {
    return {
      label: "Cerrado",
      className: "text-[var(--warning)]",
      icon: <Clock3 size={14} aria-hidden="true" />,
    };
  }
  return {
    label: "Por elegir",
    className: "text-[var(--brand)]",
    icon: <UtensilsCrossed size={14} aria-hidden="true" />,
  };
}
