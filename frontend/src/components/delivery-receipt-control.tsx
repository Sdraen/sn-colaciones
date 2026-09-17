"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Save } from "lucide-react";
import { SuccessDialog } from "@/components/ui/success-dialog";
import { browserApiRequest } from "@/lib/api/client";
import type { DeliveryReceiptCheckDto } from "@/lib/api/contracts";
import { formatChileanDateTime } from "@/lib/date-format";

export function DeliveryReceiptControl({
  control,
  viewerRole,
  arrivalRecorded,
  receiptConfirmed,
  onUpdate,
}: {
  control: DeliveryReceiptCheckDto;
  viewerRole: "provider_admin" | "company_admin" | "delivery";
  arrivalRecorded: boolean;
  receiptConfirmed: boolean;
  onUpdate: (control: DeliveryReceiptCheckDto) => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [generalNote, setGeneralNote] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const editable = viewerRole === "company_admin" && arrivalRecorded && !receiptConfirmed;

  const parsedItems = useMemo(
    () => control.items.map((item) => {
      const rawQuantity = quantities[item.key]
        ?? String(item.receivedQuantity ?? item.expectedQuantity);
      const received = Number(rawQuantity);
      return {
        ...item,
        storedReceivedQuantity: item.receivedQuantity,
        receivedQuantity: Number.isInteger(received) && received >= 0 ? received : null,
      };
    }),
    [control.items, quantities],
  );
  const invalid = parsedItems.some((item) => item.receivedQuantity === null);
  const missingTotal = parsedItems.reduce(
    (total, item) => total + Math.max(item.expectedQuantity - (item.receivedQuantity ?? item.expectedQuantity), 0),
    0,
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || invalid) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const updated = await browserApiRequest<DeliveryReceiptCheckDto>(
        `/api/v1/company/service-days/${control.serviceDayId}/receipt-check`,
        {
          method: "PUT",
          body: JSON.stringify({
            items: parsedItems.map((item) => ({
              key: item.key,
              receivedQuantity: item.receivedQuantity,
              note: (notes[item.key] ?? item.note ?? "").trim() || null,
            })),
            generalNote: (generalNote ?? control.generalNote ?? "").trim() || null,
          }),
        },
      );
      setQuantities({});
      setNotes({});
      setGeneralNote(undefined);
      onUpdate(updated);
      setMessage(
        updated.items.some((item) => (item.receivedQuantity ?? 0) < item.expectedQuantity)
          ? "Control guardado. La proveedora fue avisada de los faltantes."
          : "Control de recepción guardado sin faltantes.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible guardar el control de recepción.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card print:hidden" aria-labelledby="receipt-control-title">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Control de recepción</p>
          <h3 id="receipt-control-title" className="mt-1 text-lg font-black">
            Cantidades esperadas y recibidas
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Securitas registra cualquier faltante u observación específica de la entrega.
          </p>
        </div>
        <ReceiptStatus control={control} missingTotal={missingTotal} />
      </div>

      {!arrivalRecorded ? (
        <div className="m-5 rounded-xl bg-[var(--accent-soft)] p-4 text-sm font-semibold text-[var(--warning)]">
          Primero Securitas debe confirmar que la comida llegó para iniciar el control de recepción.
        </div>
      ) : control.items.length === 0 ? (
        <p className="p-6 text-sm text-[var(--muted)]">No existen colaciones confirmadas para revisar.</p>
      ) : (
        <form onSubmit={save} className="p-5">
          <div className="space-y-3">
            {parsedItems.map((item) => {
              const missing = item.receivedQuantity === null
                ? null
                : Math.max(item.expectedQuantity - item.receivedQuantity, 0);
              return (
                <article key={item.key} className={`rounded-2xl border p-4 ${missing ? "border-red-200 bg-red-50/50" : "border-[var(--line)] bg-white"}`}>
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_100px_120px] sm:items-end">
                    <div className="min-w-0">
                      <span className="text-[11px] font-black uppercase tracking-wide text-[var(--brand)]">
                        {itemTypeLabel(item.type)}
                      </span>
                      <strong className="mt-1 block text-sm sm:text-base">{item.label}</strong>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-[var(--muted)]">Esperadas</span>
                      <strong className="mt-1 block text-2xl">{item.expectedQuantity}</strong>
                    </div>
                    <label className="text-xs font-extrabold">
                      Recibidas
                      {editable ? (
                        <input
                          type="number"
                          min="0"
                          max="100000"
                          step="1"
                          required
                          inputMode="numeric"
                          value={quantities[item.key] ?? ""}
                          onChange={(event) => {
                            setQuantities((current) => ({ ...current, [item.key]: event.target.value }));
                          }}
                          className="form-control mt-1 min-h-11 px-3 text-lg font-black"
                        />
                      ) : (
                        <span className="mt-1 block text-2xl">
                          {item.storedReceivedQuantity ?? "Sin revisar"}
                        </span>
                      )}
                    </label>
                  </div>

                  {missing !== null && missing > 0 ? (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 text-xs font-extrabold text-[var(--danger)]">
                      <AlertTriangle size={14} /> Faltan {missing}
                    </div>
                  ) : null}

                  {editable ? (
                    <label className="mt-3 block text-xs font-extrabold">
                      Observación de este ítem <span className="font-normal text-[var(--muted)]">(opcional)</span>
                      <input
                        value={notes[item.key] ?? item.note ?? ""}
                        onChange={(event) => {
                            setNotes((current) => ({ ...current, [item.key]: event.target.value }));
                        }}
                        maxLength={500}
                        className="form-control mt-1 min-h-11 px-3 text-sm font-normal"
                        placeholder="Ej.: faltó una bandeja o llegó dañada"
                      />
                    </label>
                  ) : item.note ? (
                    <p className="mt-3 rounded-xl bg-[var(--surface-muted)] p-3 text-sm"><strong>Observación:</strong> {item.note}</p>
                  ) : null}
                </article>
              );
            })}
          </div>

          {editable ? (
            <>
              <label className="mt-5 block text-sm font-extrabold">
                Observación general <span className="font-normal text-[var(--muted)]">(opcional)</span>
                <textarea
                  value={generalNote ?? control.generalNote ?? ""}
                  onChange={(event) => {
                    setGeneralNote(event.target.value);
                  }}
                  maxLength={1000}
                  rows={3}
                  className="form-control mt-2 p-3 font-normal"
                  placeholder="Ej.: una caja llegó abierta o la entrega se realizó en dos partes"
                />
              </label>
              <p className="mt-3 text-xs font-semibold text-[var(--muted)]">
                Si registras una diferencia u observación, la proveedora recibirá una notificación.
              </p>
              {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">{error}</p> : null}
              <button
                type="submit"
                disabled={saving || invalid}
                className="company-action mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-extrabold text-white disabled:opacity-50 sm:w-auto"
              >
                <Save size={17} /> {saving ? "Guardando…" : "Guardar control de recepción"}
              </button>
            </>
          ) : control.generalNote ? (
            <p className="mt-4 rounded-xl bg-[var(--surface-muted)] p-3 text-sm"><strong>Observación general:</strong> {control.generalNote}</p>
          ) : null}
        </form>
      )}

      <SuccessDialog message={message || null} onClose={() => setMessage("")} />
    </section>
  );
}

function ReceiptStatus({
  control,
  missingTotal,
}: {
  control: DeliveryReceiptCheckDto;
  missingTotal: number;
}) {
  if (!control.reportedAt) {
    return <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-extrabold text-[var(--warning)]"><ClipboardCheck size={15} /> Pendiente de revisión</span>;
  }
  if (missingTotal > 0) {
    return <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-red-100 px-3 py-2 text-xs font-extrabold text-[var(--danger)]"><AlertTriangle size={15} /> {missingTotal} faltante(s)</span>;
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--herb-soft)] px-3 py-2 text-xs font-extrabold text-[var(--herb-strong)]" title={formatChileanDateTime(control.reportedAt)}>
      <CheckCircle2 size={15} /> Recepción revisada
    </span>
  );
}

function itemTypeLabel(type: DeliveryReceiptCheckDto["items"][number]["type"]) {
  if (type === "menu") return "Preparación";
  if (type === "side") return "Acompañamiento";
  return "Complemento";
}
