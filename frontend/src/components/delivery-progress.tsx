"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Check,
  Clock3,
  MapPinCheck,
  PackageCheck,
} from "lucide-react";
import { browserApiRequest } from "@/lib/api/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SuccessDialog } from "@/components/ui/success-dialog";
import type { DeliveryReceiptCheckDto, DeliveryTrackingDto } from "@/lib/api/contracts";
import { formatChileanDateTime } from "@/lib/date-format";

type ViewerRole = "provider_admin" | "company_admin" | "delivery";

interface DeliveryProgressProps {
  tracking: DeliveryTrackingDto;
  serviceDate: string;
  viewerRole: ViewerRole;
  receptionControl: DeliveryReceiptCheckDto;
  onUpdate: (tracking: DeliveryTrackingDto) => void;
}

const steps = [
  { key: "arrivedAt", label: "Llegó a Securitas", icon: MapPinCheck },
  { key: "deliveredAt", label: "Entrega terminada", icon: PackageCheck },
  { key: "receiptConfirmedAt", label: "Recepción confirmada", icon: BadgeCheck },
] as const;

export function DeliveryProgress({
  tracking,
  serviceDate,
  viewerRole,
  receptionControl,
  onUpdate,
}: DeliveryProgressProps) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const today = chileToday();
  const isToday = serviceDate === today;
  const nextAction = getNextAction(tracking, receptionControl, viewerRole, isToday);

  async function advance() {
    if (!nextAction) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await browserApiRequest<DeliveryTrackingDto>(
        nextAction.endpoint,
        {
          method: "PATCH",
          body: JSON.stringify(nextAction.body),
        },
      );
      onUpdate(mergeDeliveryTracking(tracking, updated));
      setFeedback({ kind: "success", text: nextAction.successMessage });
    } catch (error) {
      setFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "No fue posible actualizar el despacho",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card print:hidden" aria-labelledby="delivery-progress-title">
      <div className="border-b border-[var(--line)] px-5 py-4">
        <p className="eyebrow">Seguimiento del día</p>
        <h3 id="delivery-progress-title" className="mt-1 text-lg font-black">
          Recepción de las colaciones
        </h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Cada marca registra automáticamente la persona responsable y la hora.
        </p>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-3">
        {steps.map(({ key, label, icon: Icon }, index) => {
          const timestamp = tracking[key];
          const completed = Boolean(timestamp);
          const previousCompleted =
            index === 0 || Boolean(tracking[steps[index - 1]!.key]);
          return (
            <article
              key={key}
              className={`rounded-2xl border p-4 transition-colors ${
                completed
                  ? "border-green-200 bg-[var(--herb-soft)]"
                  : previousCompleted
                    ? "border-[var(--line)] bg-[var(--accent-soft)]"
                    : "border-[var(--line)] bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`inline-flex size-10 items-center justify-center rounded-xl ${
                    completed
                      ? "bg-[var(--herb)] text-white"
                      : "bg-white text-[var(--muted)]"
                  }`}
                >
                  {completed ? <Check size={20} /> : <Icon size={20} />}
                </span>
                <span className="text-xs font-extrabold text-[var(--muted)]">
                  Paso {index + 1}
                </span>
              </div>
              <strong className="mt-4 block text-sm">{label}</strong>
              <span className="mt-1 block text-xs text-[var(--muted)]">
                {timestamp ? formatChileanDateTime(timestamp) : "Pendiente"}
              </span>
              {timestamp ? (
                <span className="mt-1 block text-xs font-bold text-[var(--muted)]">
                  {formatActor(getStepActor(tracking, key))}
                </span>
              ) : null}
              {key === "arrivedAt" ? (
                <span className={`mt-1 block text-xs font-bold ${
                  tracking.companyArrivalConfirmedAt
                    ? "text-[var(--herb-strong)]"
                    : "text-[var(--warning)]"
                }`}>
                  {tracking.companyArrivalConfirmedAt
                    ? `Confirmado por Securitas: ${tracking.companyArrivalConfirmedByProfile?.fullName ?? "responsable registrado"}`
                    : "Confirmación de Securitas pendiente"}
                </span>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <StatusMessage
          tracking={tracking}
          receptionControl={receptionControl}
          viewerRole={viewerRole}
          isToday={isToday}
        />
        {nextAction ? (
          nextAction.confirmation ? (
            <ConfirmDialog
              title={nextAction.label}
              description={nextAction.confirmation}
              confirmLabel="Sí, confirmar"
              onConfirm={advance}
              trigger={
                <DeliveryActionButton
                  saving={saving}
                  label={nextAction.label}
                  icon={nextAction.icon}
                />
              }
            />
          ) : (
            <DeliveryActionButton
              saving={saving}
              label={nextAction.label}
              icon={nextAction.icon}
              onClick={advance}
            />
          )
        ) : null}
      </div>

      <SuccessDialog
        message={feedback?.kind === "success" ? feedback.text : null}
        onClose={() => setFeedback(null)}
      />
      {feedback?.kind === "error" ? (
        <p
          role="alert"
          className="mx-5 mb-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]"
        >
          {feedback.text}
        </p>
      ) : null}
    </section>
  );
}

function DeliveryActionButton({
  saving,
  label,
  icon: Icon,
  onClick,
}: {
  saving: boolean;
  label: string;
  icon: typeof MapPinCheck;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="company-action inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-extrabold text-white disabled:cursor-wait disabled:opacity-60 sm:w-auto"
    >
      {saving ? <Clock3 className="animate-pulse" size={17} /> : <Icon size={17} />}
      {saving ? "Guardando…" : label}
    </button>
  );
}

function StatusMessage({
  tracking,
  receptionControl,
  viewerRole,
  isToday,
}: {
  tracking: DeliveryTrackingDto;
  receptionControl: DeliveryReceiptCheckDto;
  viewerRole: ViewerRole;
  isToday: boolean;
}) {
  let text = "Despacho todavía no ha llegado a Securitas.";
  if (tracking.receiptConfirmedAt) {
    text = "La recepción fue confirmada por Securitas.";
  } else if (
    viewerRole === "company_admin" &&
    tracking.arrivedAt &&
    !tracking.companyArrivalConfirmedAt
  ) {
    text = "Despacho informó que llegó. Securitas debe confirmar la llegada para habilitar el control de recepción.";
  } else if (tracking.deliveredAt) {
    if (viewerRole === "company_admin" && !receptionControl.reportedAt) {
      text = "Despacho terminó la entrega. Revisa y guarda las cantidades recibidas.";
    } else if (viewerRole === "company_admin" && hasReceiptShortages(receptionControl)) {
      text = "Hay faltantes pendientes. Actualiza el control cuando sean resueltos.";
    } else {
      text = viewerRole === "company_admin"
        ? "El control está completo. Ya puedes confirmar la recepción."
        : "La entrega terminó y está esperando confirmación de Securitas.";
    }
  } else if (tracking.companyArrivalConfirmedAt) {
    const actor = tracking.companyArrivalConfirmedByProfile;
    text = `${actor?.fullName ?? "Securitas"} confirmó que la comida llegó. Ya puedes completar el control de recepción.`;
  } else if (tracking.arrivedAt) {
    text = `${tracking.arrivedByProfile?.fullName ?? "Despacho"} registró la llegada a Securitas y está realizando la entrega.`;
  } else if (viewerRole === "delivery" && !isToday) {
    text = "Los hitos de despacho solo se registran durante el día correspondiente.";
  } else if (viewerRole === "company_admin" && isToday) {
    text = "Cuando lleguen las colaciones, registra la hora para iniciar la revisión.";
  }
  return <p className="text-sm font-semibold text-[var(--muted)]">{text}</p>;
}

function getNextAction(
  tracking: DeliveryTrackingDto,
  receptionControl: DeliveryReceiptCheckDto,
  viewerRole: ViewerRole,
  isToday: boolean,
) {
  if (
    viewerRole === "company_admin" &&
    isToday &&
    !tracking.companyArrivalConfirmedAt
  ) {
    return {
      label: "Confirmar llegada de la comida",
      icon: MapPinCheck,
      endpoint: `/api/v1/company/service-days/${tracking.serviceDayId}/arrival`,
      body: { confirmed: true },
      successMessage: "Securitas registró la llegada de la comida.",
      confirmation: "¿Confirmas que la comida llegó a Securitas? Se guardarán tu nombre y la hora, y se habilitará el control de recepción.",
    };
  }
  if (viewerRole === "delivery" && isToday && !tracking.arrivedAt) {
    return {
      label: "Marcar llegada",
      icon: MapPinCheck,
      endpoint: `/api/v1/delivery/service-days/${tracking.serviceDayId}/events`,
      body: { event: "arrived" },
      successMessage: "Llegada a Securitas registrada.",
      confirmation: null,
    };
  }
  if (viewerRole === "delivery" && isToday && !tracking.deliveredAt) {
    return {
      label: "Terminar entrega",
      icon: PackageCheck,
      endpoint: `/api/v1/delivery/service-days/${tracking.serviceDayId}/events`,
      body: { event: "delivered" },
      successMessage: "Entrega terminada y hora registrada.",
      confirmation: "¿Confirmas que terminaste de entregar todas las colaciones?",
    };
  }
  if (
    viewerRole === "company_admin" &&
    tracking.deliveredAt &&
    !tracking.receiptConfirmedAt &&
    Boolean(receptionControl.reportedAt) &&
    !hasReceiptShortages(receptionControl)
  ) {
    return {
      label: "Confirmar recepción",
      icon: BadgeCheck,
      endpoint: `/api/v1/company/service-days/${tracking.serviceDayId}/receipt`,
      body: { confirmed: true },
      successMessage: "Recepción completa confirmada.",
      confirmation: "¿Confirmas que Securitas recibió todas las colaciones del día?",
    };
  }
  return null;
}

function hasReceiptShortages(control: DeliveryReceiptCheckDto) {
  return control.items.some(
    (item) => item.receivedQuantity !== null && item.receivedQuantity < item.expectedQuantity,
  );
}

function mergeDeliveryTracking(
  current: DeliveryTrackingDto,
  updated: DeliveryTrackingDto,
): DeliveryTrackingDto {
  return {
    ...updated,
    arrivedByProfile: updated.arrivedByProfile ?? current.arrivedByProfile,
    companyArrivalConfirmedByProfile:
      updated.companyArrivalConfirmedByProfile
      ?? current.companyArrivalConfirmedByProfile,
    deliveredByProfile: updated.deliveredByProfile ?? current.deliveredByProfile,
    receiptConfirmedByProfile:
      updated.receiptConfirmedByProfile ?? current.receiptConfirmedByProfile,
  };
}

function getStepActor(
  tracking: DeliveryTrackingDto,
  key: (typeof steps)[number]["key"],
) {
  if (key === "arrivedAt") return tracking.arrivedByProfile;
  if (key === "deliveredAt") return tracking.deliveredByProfile;
  return tracking.receiptConfirmedByProfile;
}

function formatActor(actor: DeliveryTrackingDto["arrivedByProfile"]) {
  if (!actor) return "Responsable registrado";
  const role = actor.role === "company_admin"
    ? "Securitas"
    : actor.role === "delivery"
      ? "Despacho"
      : "Proveedora";
  return `${role}: ${actor.fullName}`;
}

function chileToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
