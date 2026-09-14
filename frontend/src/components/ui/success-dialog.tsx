"use client";

import { CheckCircle2 } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

export function SuccessDialog({
  message,
  onClose,
  title = "Operación completada",
}: {
  message: string | null;
  onClose: () => void;
  title?: string;
}) {
  return (
    <DialogPrimitive.Root
      open={Boolean(message)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="app-dialog-overlay" />
        <DialogPrimitive.Content className="app-dialog-content">
          <div className="grid size-12 place-items-center rounded-2xl bg-[var(--herb-soft)] text-[var(--herb-strong)]">
            <CheckCircle2 size={23} aria-hidden="true" />
          </div>

          <div className="mt-4">
            <p className="eyebrow">Confirmación</p>
            <DialogPrimitive.Title className="mt-1 text-xl font-black">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {message ?? "La operación se realizó correctamente."}
            </DialogPrimitive.Description>
          </div>

          <DialogPrimitive.Close asChild>
            <button
              type="button"
              className="focus-ring mt-6 min-h-11 w-full rounded-xl bg-[var(--herb)] px-4 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              Entendido
            </button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
