"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { browserApiRequest } from "@/lib/api/client";
import type { ExceptionDto, MenuOptionDto, OrderDto, SideChoice } from "@/lib/api/contracts";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormSelect } from "@/components/ui/form-select";

const SIDE_OPTIONS = [
  { value: "ensalada", label: "Ensalada" },
  { value: "fruta", label: "Fruta" },
  { value: "postre", label: "Postre" },
  { value: "ninguno", label: "Ninguno" },
];

type MutationCallbacks = {
  onChanged: () => void | Promise<void>;
  onBusyChange: (busy: boolean) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function OperationalOrderActions({
  order,
  menuOptions,
  ...callbacks
}: {
  order: OrderDto;
  menuOptions: MenuOptionDto[];
} & MutationCallbacks) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(order.beneficiaryLabel ?? "");
  const [attendeeCount, setAttendeeCount] = useState(String(order.quantity));
  const [menuOptionId, setMenuOptionId] = useState(order.menuOptionId);
  const [side, setSide] = useState<SideChoice>(order.side);
  const [complement, setComplement] = useState<"bread" | "tea">(
    order.bread ? "bread" : "tea",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const training = order.kind === "training";

  function resetForm() {
    setName(order.beneficiaryLabel ?? "");
    setAttendeeCount(String(order.quantity));
    setMenuOptionId(order.menuOptionId);
    setSide(order.side);
    setComplement(order.bread ? "bread" : "tea");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    callbacks.onBusyChange(true);
    setError("");
    try {
      await browserApiRequest<OrderDto>(`/api/v1/company/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          menuOptionId,
          name,
          attendeeCount: training ? Number(attendeeCount) : null,
          side,
          bread: complement === "bread",
          tea: complement === "tea",
        }),
      });
      await callbacks.onChanged();
      setOpen(false);
      callbacks.onSuccess(
        training ? "Capacitación modificada correctamente." : "Colación extra modificada correctamente.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible modificar el registro.");
    } finally {
      setSaving(false);
      callbacks.onBusyChange(false);
    }
  }

  async function remove() {
    callbacks.onBusyChange(true);
    try {
      await browserApiRequest(`/api/v1/company/orders/${order.id}`, { method: "DELETE" });
      await callbacks.onChanged();
      callbacks.onSuccess(
        training ? "Capacitación eliminada correctamente." : "Colación extra eliminada correctamente.",
      );
    } catch (caught) {
      callbacks.onError(caught instanceof Error ? caught.message : "No fue posible eliminar el registro.");
    } finally {
      callbacks.onBusyChange(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) resetForm();
        }}
      >
        <DialogPrimitive.Trigger asChild>
          <button
            type="button"
            className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--brand-soft)] px-3 text-xs font-extrabold text-[var(--brand-strong)]"
          >
            <Pencil size={14} aria-hidden="true" /> Editar
          </button>
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="app-dialog-overlay" />
          <DialogPrimitive.Content className="app-dialog-content">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Corregir registro</p>
                <DialogPrimitive.Title className="mt-1 text-xl font-black">
                  {training ? "Editar capacitación" : "Editar colación extra"}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Los cambios actualizarán inmediatamente el conteo del día.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close asChild>
                <button type="button" aria-label="Cerrar" className="focus-ring grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-white">
                  <X size={18} aria-hidden="true" />
                </button>
              </DialogPrimitive.Close>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block text-sm font-extrabold">
                {training ? "Nombre de la capacitación" : "Persona o referencia"}
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  className="form-control mt-2 px-4 font-normal"
                />
              </label>

              {training ? (
                <label className="block text-sm font-extrabold">
                  Cantidad de alumnos
                  <input
                    value={attendeeCount}
                    onChange={(event) => setAttendeeCount(event.target.value)}
                    type="number"
                    min="1"
                    max="500"
                    required
                    className="form-control mt-2 px-4 font-normal"
                  />
                </label>
              ) : (
                <label className="block text-sm font-extrabold">
                  Menú solicitado
                  <FormSelect
                    value={menuOptionId}
                    onValueChange={setMenuOptionId}
                    options={menuOptions.map((option) => ({
                      value: option.id,
                      label: `${option.label} · ${option.description}`,
                    }))}
                    ariaLabel="Menú solicitado"
                    className="mt-2 text-sm font-semibold"
                  />
                </label>
              )}

              <MealSelectionFields
                side={side}
                complement={complement}
                onSideChange={setSide}
                onComplementChange={setComplement}
              />

              {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">{error}</p> : null}

              <button
                type="submit"
                disabled={saving}
                className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-extrabold text-white disabled:opacity-50"
              >
                <Save size={17} aria-hidden="true" /> {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <ConfirmDialog
        title={training ? "¿Eliminar esta capacitación?" : "¿Eliminar esta colación extra?"}
        description={
          training
            ? `Se descontarán ${order.quantity} alumnos del conteo del día.`
            : "La colación dejará de formar parte del conteo del día."
        }
        confirmLabel="Sí, eliminar"
        tone="danger"
        onConfirm={remove}
        trigger={
          <button type="button" aria-label="Eliminar registro" className="focus-ring grid size-9 place-items-center rounded-lg text-[var(--danger)] transition hover:bg-red-50">
            <Trash2 size={15} aria-hidden="true" />
          </button>
        }
      />
    </div>
  );
}

export function ExtraRequestActions({
  request,
  menuOptions,
  ...callbacks
}: {
  request: ExceptionDto;
  menuOptions: MenuOptionDto[];
} & MutationCallbacks) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(request.beneficiaryLabel);
  const [reason, setReason] = useState(request.reason);
  const [menuOptionId, setMenuOptionId] = useState(request.menuOptionId);
  const [side, setSide] = useState<SideChoice>(request.side);
  const [complement, setComplement] = useState<"bread" | "tea">(
    request.bread ? "bread" : "tea",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function resetForm() {
    setName(request.beneficiaryLabel);
    setReason(request.reason);
    setMenuOptionId(request.menuOptionId);
    setSide(request.side);
    setComplement(request.bread ? "bread" : "tea");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    callbacks.onBusyChange(true);
    setError("");
    try {
      await browserApiRequest<ExceptionDto>(`/api/v1/company/extra-requests/${request.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          menuOptionId,
          beneficiaryLabel: name,
          reason,
          side,
          bread: complement === "bread",
          tea: complement === "tea",
        }),
      });
      await callbacks.onChanged();
      setOpen(false);
      callbacks.onSuccess("Solicitud de colación extra modificada correctamente.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible modificar la solicitud.");
    } finally {
      setSaving(false);
      callbacks.onBusyChange(false);
    }
  }

  async function remove() {
    callbacks.onBusyChange(true);
    try {
      await browserApiRequest(`/api/v1/company/extra-requests/${request.id}`, { method: "DELETE" });
      await callbacks.onChanged();
      callbacks.onSuccess("Solicitud de colación extra eliminada correctamente.");
    } catch (caught) {
      callbacks.onError(caught instanceof Error ? caught.message : "No fue posible eliminar la solicitud.");
    } finally {
      callbacks.onBusyChange(false);
    }
  }

  return (
    <div className="mt-3 flex items-center justify-end gap-2 border-t border-[var(--line)] pt-3">
      {request.status === "pending" ? (
        <DialogPrimitive.Root
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen) resetForm();
          }}
        >
          <DialogPrimitive.Trigger asChild>
            <button type="button" className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--brand-soft)] px-3 text-xs font-extrabold text-[var(--brand-strong)]">
              <Pencil size={14} aria-hidden="true" /> Editar
            </button>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="app-dialog-overlay" />
            <DialogPrimitive.Content className="app-dialog-content">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Corregir solicitud</p>
                  <DialogPrimitive.Title className="mt-1 text-xl font-black">Editar colación extra tardía</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Puedes corregirla mientras la proveedora todavía no la haya resuelto.
                  </DialogPrimitive.Description>
                </div>
                <DialogPrimitive.Close asChild>
                  <button type="button" aria-label="Cerrar" className="focus-ring grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-white">
                    <X size={18} aria-hidden="true" />
                  </button>
                </DialogPrimitive.Close>
              </div>

              <form onSubmit={submit} className="mt-5 space-y-4">
                <label className="block text-sm font-extrabold">
                  Persona o referencia
                  <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} className="form-control mt-2 px-4 font-normal" />
                </label>
                <label className="block text-sm font-extrabold">
                  Menú solicitado
                  <FormSelect
                    value={menuOptionId}
                    onValueChange={setMenuOptionId}
                    options={menuOptions.map((option) => ({ value: option.id, label: `${option.label} · ${option.description}` }))}
                    ariaLabel="Menú solicitado"
                    className="mt-2 text-sm font-semibold"
                  />
                </label>
                <MealSelectionFields side={side} complement={complement} onSideChange={setSide} onComplementChange={setComplement} />
                <label className="block text-sm font-extrabold">
                  Motivo de la solicitud tardía
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={5} maxLength={500} rows={3} className="form-control mt-2 p-4 font-normal" />
                </label>
                {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">{error}</p> : null}
                <button type="submit" disabled={saving} className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-extrabold text-white disabled:opacity-50">
                  <Save size={17} aria-hidden="true" /> {saving ? "Guardando…" : "Guardar cambios"}
                </button>
              </form>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      ) : null}

      <ConfirmDialog
        title="¿Eliminar esta solicitud de colación extra?"
        description="Se quitará la solicitud y, si ya fue aprobada, también su colación asociada."
        confirmLabel="Sí, eliminar"
        tone="danger"
        onConfirm={remove}
        trigger={
          <button type="button" className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold text-[var(--danger)] transition hover:bg-red-50">
            <Trash2 size={14} aria-hidden="true" /> Eliminar
          </button>
        }
      />
    </div>
  );
}

function MealSelectionFields({
  side,
  complement,
  onSideChange,
  onComplementChange,
}: {
  side: SideChoice;
  complement: "bread" | "tea";
  onSideChange: (side: SideChoice) => void;
  onComplementChange: (complement: "bread" | "tea") => void;
}) {
  return (
    <>
      <label className="block text-sm font-extrabold">
        Acompañamiento
        <FormSelect
          value={side}
          onValueChange={(value) => onSideChange(value as SideChoice)}
          options={SIDE_OPTIONS}
          ariaLabel="Acompañamiento"
          className="mt-2 text-sm font-semibold"
        />
      </label>
      <fieldset>
        <legend className="text-sm font-extrabold">Complemento</legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {(["bread", "tea"] as const).map((value) => (
            <label key={value} className={`cursor-pointer rounded-xl border p-3 font-bold ${complement === value ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-white"}`}>
              <input type="radio" checked={complement === value} onChange={() => onComplementChange(value)} className="mr-2 accent-[var(--brand)]" />
              {value === "bread" ? "Pan" : "Té"}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
