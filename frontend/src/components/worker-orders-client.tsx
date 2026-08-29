"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, Coffee, Salad, Trash2, UserRound } from "lucide-react";
import { browserApiRequest } from "@/lib/api/client";
import type { OrderDto, SideChoice, WorkerOrdersDto } from "@/lib/api/contracts";

interface Draft { menuOptionId: string; side: SideChoice | ""; bread: boolean; tea: boolean; }
const emptyDraft: Draft = { menuOptionId: "", side: "", bread: false, tea: false };

export function WorkerOrdersClient({ userName, initialData, nowIso }: { userName: string; initialData: WorkerOrdersDto; nowIso: string }) {
  const [orders, setOrders] = useState(initialData.orders);
  const [activeDayId, setActiveDayId] = useState(initialData.menuWeek.days[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const activeDay = initialData.menuWeek.days.find((day) => day.id === activeDayId);
  const existingOrder = orders.find((order) => order.serviceDayId === activeDayId && order.status === "confirmed");
  const canReserve = Boolean(activeDay && !activeDay.disabled && new Date(nowIso) <= new Date(activeDay.preorderDeadline));

  function openDay(dayId: string) {
    const order = orders.find((item) => item.serviceDayId === dayId && item.status === "confirmed");
    setActiveDayId(dayId);
    setDraft(order ? { menuOptionId: order.menuOptionId, side: order.side, bread: order.bread, tea: order.tea } : emptyDraft);
    setMessage(""); setError("");
  }

  async function saveOrder() {
    if (!activeDay || !draft.menuOptionId || !draft.side || draft.bread === draft.tea) return;
    setSaving(true); setError("");
    try {
      const saved = await browserApiRequest<OrderDto>("/api/v1/orders/me", { method: "PUT", body: JSON.stringify({ serviceDayId: activeDay.id, menuOptionId: draft.menuOptionId, side: draft.side, bread: draft.bread, tea: draft.tea }) });
      setOrders((current) => [...current.filter((order) => order.serviceDayId !== activeDay.id), saved]);
      setMessage("Pedido guardado correctamente.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible guardar el pedido"); }
    finally { setSaving(false); }
  }

  async function cancelOrder() {
    if (!existingOrder) return;
    setSaving(true); setError("");
    try {
      await browserApiRequest<OrderDto>(`/api/v1/orders/me/${existingOrder.id}`, { method: "DELETE" });
      setOrders((current) => current.filter((order) => order.id !== existingOrder.id));
      setDraft(emptyDraft); setMessage("Pedido eliminado correctamente.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible eliminar el pedido"); }
    finally { setSaving(false); }
  }

  if (!activeDay) return null;
  return (
    <main className="page-shell">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="eyebrow">Menú semanal</p><h1 className="mt-2 text-3xl font-black">Elige tu colación</h1><p className="mt-2 text-sm text-[var(--muted)]">Semana del {formatShortDate(initialData.menuWeek.startsOn)}</p></div><span className="card flex items-center gap-3 px-4 py-3 text-sm font-bold"><UserRound size={18} /> {userName}</span></div>
      <div className="mt-8 flex gap-2 overflow-x-auto pb-2" role="tablist">{initialData.menuWeek.days.map((day) => <button key={day.id} type="button" role="tab" aria-selected={day.id === activeDayId} onClick={() => openDay(day.id)} className={`focus-ring min-w-20 rounded-2xl border px-4 py-3 text-sm font-bold ${day.id === activeDayId ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-white"}`}>{formatWeekday(day.serviceDate)}<span className="mt-1 block text-lg font-black">{day.serviceDate.slice(-2)}</span></button>)}</div>
      <div className={`mt-4 flex gap-3 rounded-2xl border p-4 ${canReserve ? "border-[var(--herb)]/25 bg-[var(--herb-soft)] text-[var(--herb-strong)]" : "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--warning)]"}`}><Clock3 size={19} className="shrink-0" /><p className="text-sm"><strong className="block">{canReserve ? "Reserva disponible" : "Reserva cerrada"}</strong>{canReserve ? `Puedes guardar cambios hasta ${formatDateTime(activeDay.preorderDeadline)}.` : "Este pedido ya no se puede modificar."}</p></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="card p-5 sm:p-7"><h2 className="text-xl font-black">{formatLongDate(activeDay.serviceDate)}</h2><fieldset className="mt-5 space-y-3"><legend className="mb-4 font-extrabold">1. Plato principal</legend>{activeDay.options.filter((option) => option.visible).map((option) => <label key={option.id} className={`flex cursor-pointer gap-4 rounded-2xl border p-4 ${draft.menuOptionId === option.id ? "border-[var(--brand)] bg-[var(--brand-soft)]/70" : "border-[var(--line)]"}`}><input type="radio" name="main" disabled={!canReserve} checked={draft.menuOptionId === option.id} onChange={() => setDraft((current) => ({ ...current, menuOptionId: option.id }))} className="mt-1 size-4 accent-[var(--brand)]" /><span><span className="block text-xs font-extrabold uppercase text-[var(--brand)]">{option.label}</span><span className="mt-1 block font-bold">{option.description}</span>{option.capacity !== null ? <span className="mt-1 block text-xs text-[var(--muted)]">Disponibilidad informada: {option.capacity}</span> : null}</span></label>)}</fieldset></section>
        <aside className="space-y-5">
          <section className="card p-5"><h2 className="flex items-center gap-2 font-extrabold"><Salad size={20} /> 2. Acompañamiento</h2><div className="mt-4 grid grid-cols-3 gap-2">{([["ensalada","Ensalada"],["postre","Postre"],["ninguno","Ninguno"]] as const).map(([value,label]) => <button key={value} type="button" disabled={!canReserve} onClick={() => setDraft((current) => ({...current,side:value}))} className={`min-h-14 rounded-xl border text-xs font-bold ${draft.side === value ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)]"}`}>{label}</button>)}</div></section>
          <section className="card p-5"><h2 className="flex items-center gap-2 font-extrabold"><Coffee size={20} /> 3. Pan o té</h2><div className="mt-4 grid grid-cols-2 gap-3">{([["bread","Pan"],["tea","Té"]] as const).map(([field,label]) => <label key={field} className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-3 font-bold"><input type="radio" name="complement" disabled={!canReserve} checked={field === "bread" ? draft.bread : draft.tea} onChange={() => setDraft((current) => ({...current,bread:field === "bread",tea:field === "tea"}))} />{label}</label>)}</div></section>
          <button type="button" onClick={saveOrder} disabled={!canReserve || saving || !draft.menuOptionId || !draft.side || draft.bread === draft.tea} className="focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] font-extrabold text-white disabled:opacity-40"><CheckCircle2 size={18} /> {saving ? "Guardando…" : existingOrder ? "Guardar cambios" : "Confirmar pedido"}</button>
          {existingOrder ? <button type="button" onClick={cancelOrder} disabled={saving || !canReserve} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl font-bold text-[var(--danger)] disabled:opacity-40"><Trash2 size={16} /> Eliminar pedido</button> : null}
          {message ? <p role="status" className="rounded-xl bg-[var(--herb-soft)] p-3 text-sm font-bold text-[var(--herb-strong)]">{message}</p> : null}{error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">{error}</p> : null}
        </aside>
      </div>
    </main>
  );
}

function dateFromIso(value: string) { return new Date(`${value}T12:00:00.000Z`); }
function formatWeekday(value: string) { return new Intl.DateTimeFormat("es-CL", { weekday: "short", timeZone: "UTC" }).format(dateFromIso(value)).toUpperCase(); }
function formatLongDate(value: string) { return new Intl.DateTimeFormat("es-CL", { dateStyle: "full", timeZone: "UTC" }).format(dateFromIso(value)); }
function formatShortDate(value: string) { return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", timeZone: "UTC" }).format(dateFromIso(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(value)); }
