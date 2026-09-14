"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  tone = "brand",
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  tone?: "brand" | "danger";
}) {
  const Icon = tone === "danger" ? AlertTriangle : CheckCircle2;

  return (
    <AlertDialogPrimitive.Root>
      <AlertDialogPrimitive.Trigger asChild>{trigger}</AlertDialogPrimitive.Trigger>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="app-dialog-overlay" />
        <AlertDialogPrimitive.Content className="app-dialog-content">
          <div
            className={`grid size-12 place-items-center rounded-2xl ${
              tone === "danger"
                ? "bg-red-50 text-[var(--danger)]"
                : "bg-[var(--brand-soft)] text-[var(--brand)]"
            }`}
          >
            <Icon size={23} aria-hidden="true" />
          </div>

          <div className="mt-4">
            <p className="eyebrow">Confirmación</p>
            <AlertDialogPrimitive.Title className="mt-1 text-xl font-black">
              {title}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {description}
            </AlertDialogPrimitive.Description>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <AlertDialogPrimitive.Cancel asChild>
              <button
                type="button"
                className="focus-ring min-h-11 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-extrabold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
              >
                Volver
              </button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <button
                type="button"
                onClick={onConfirm}
                className={`focus-ring min-h-11 rounded-xl px-4 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  tone === "danger" ? "bg-[var(--danger)]" : "bg-[var(--brand)]"
                }`}
              >
                {confirmLabel}
              </button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
