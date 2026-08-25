"use client";

import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  Coffee,
  Salad,
  Trash2,
  UserRound,
} from "lucide-react";
import { useDemo } from "@/components/demo-provider";
import type { SideChoice } from "@/types/domain";

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

export default function OrdersPage() {
  const { userName, setUserName, menus, orders, saveOrder, cancelOrder } = useDemo();
  const [activeDayId, setActiveDayId] = useState(menus[0].id);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [savedMessage, setSavedMessage] = useState(false);
  const activeDay = menus.find((day) => day.id === activeDayId) ?? menus[0];
  const existingOrder = orders[activeDayId];

  function openDay(dayId: string) {
    const order = orders[dayId];
    setActiveDayId(dayId);
    setSavedMessage(false);
    setDraft(
      order
        ? {
            menuOptionId: order.menuOptionId,
            side: order.side,
            bread: order.bread,
            tea: order.tea,
          }
        : emptyDraft,
    );
  }

  function handleSave() {
    if (!draft.menuOptionId || !draft.side) return;
    saveOrder({
      dayId: activeDayId,
      menuOptionId: draft.menuOptionId,
      side: draft.side,
      bread: draft.bread,
      tea: draft.tea,
    });
    setSavedMessage(true);
  }

  function handleCancel() {
    cancelOrder(activeDayId);
    setDraft(emptyDraft);
    setSavedMessage(false);
  }

  return (
    <main className="page-shell">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow">Menú semanal</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
            Elige tu colación
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Semana del 24 al 30 de agosto · {Object.keys(orders).length} de 7 días
            reservados
          </p>
        </div>

        <label className="card flex items-center gap-3 px-4 py-3">
          <UserRound size={18} className="text-[var(--brand)]" />
          <span className="sr-only">Nombre de demostración</span>
          <input
            value={userName}
            onChange={(event) => setUserName(event.target.value)}
            className="w-40 bg-transparent text-sm font-bold outline-none"
            aria-label="Nombre de demostración"
          />
        </label>
      </div>

      <div className="mt-8 flex gap-2 overflow-x-auto pb-2" role="tablist">
        {menus.map((day) => {
          const active = day.id === activeDayId;
          const ordered = Boolean(orders[day.id]);
          return (
            <button
              key={day.id}
              type="button"
              onClick={() => openDay(day.id)}
              className={`focus-ring relative min-w-20 rounded-2xl border px-4 py-3 text-center transition ${
                active
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white shadow-lg shadow-orange-950/15"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--brand)]/35"
              }`}
              role="tab"
              aria-selected={active}
            >
              <span className="block text-[11px] font-bold uppercase tracking-wider">
                {day.dayShort}
              </span>
              <span className="mt-1 block text-lg font-black">{day.dayNumber}</span>
              {ordered && (
                <span className={`absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border-2 text-[10px] ${active ? "border-[var(--brand)] bg-white text-[var(--brand)]" : "border-white bg-[var(--brand)] text-white"}`}>
                  <Check size={11} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="card overflow-hidden">
          <div className="border-b border-[var(--line)] bg-[var(--surface-muted)]/70 px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black tracking-[-0.025em]">
                  {activeDay.dateLabel}
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--warning)]">
                  <Clock3 size={14} /> {activeDay.cutoffLabel}
                </p>
              </div>
              {existingOrder && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--brand-strong)]">
                  <CheckCircle2 size={14} /> Confirmado
                </span>
              )}
            </div>
          </div>

          <fieldset className="space-y-3 p-5 sm:p-7">
            <legend className="mb-4 font-extrabold">1. Plato principal</legend>
            {activeDay.options.filter((menuOption) => menuOption.available).map((menuOption) => {
              const selected = draft.menuOptionId === menuOption.id;
              return (
                <label key={menuOption.id} className={`flex cursor-pointer gap-4 rounded-2xl border p-4 transition focus-within:ring-3 focus-within:ring-[rgba(216,75,42,0.18)] ${selected ? "border-[var(--brand)] bg-[var(--brand-soft)]/70" : "border-[var(--line)] hover:border-[var(--brand)]/35"}`}>
                  <input
                    type="radio"
                    name="main"
                    checked={selected}
                    onChange={() => setDraft((current) => ({ ...current, menuOptionId: menuOption.id }))}
                    className="mt-1 size-4 accent-[var(--brand)]"
                  />
                  <span>
                    <span className="block text-xs font-extrabold uppercase tracking-wider text-[var(--brand)]">
                      {menuOption.label}
                    </span>
                    <span className="mt-1 block font-bold leading-6">{menuOption.description}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        </section>

        <aside className="space-y-5">
          <section className="card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Salad size={20} />
              </span>
              <div>
                <h2 className="font-extrabold">2. Acompañamiento</h2>
                <p className="text-xs text-[var(--muted)]">Elige solo una opción</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[["ensalada", "Ensalada"], ["postre", "Fruta/postre"], ["ninguno", "Ninguno"]].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, side: value as SideChoice }))}
                  className={`focus-ring min-h-16 rounded-xl border px-2 text-xs font-bold transition ${draft.side === value ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--brand)]/35"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[var(--herb-soft)] text-[var(--herb)]">
                <Coffee size={20} />
              </span>
              <div>
                <h2 className="font-extrabold">3. Opcionales</h2>
                <p className="text-xs text-[var(--muted)]">Puedes seleccionar ambos</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[["bread", "Pan"], ["tea", "Té"]].map(([field, label]) => {
                const checked = field === "bread" ? draft.bread : draft.tea;
                return (
                  <label key={field} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-bold ${checked ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)]"}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.checked }))}
                      className="size-4 accent-[var(--brand)]"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </section>

          <button type="button" onClick={handleSave} disabled={!draft.menuOptionId || !draft.side} className="focus-ring flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-5 font-extrabold text-white shadow-lg shadow-orange-950/15 transition hover:bg-[var(--brand-strong)] disabled:cursor-not-allowed disabled:opacity-40">
            <CheckCircle2 size={19} /> {existingOrder ? "Guardar cambios" : "Confirmar pedido"}
          </button>

          {existingOrder && (
            <button type="button" onClick={handleCancel} className="focus-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-[var(--danger)] hover:bg-red-50">
              <Trash2 size={16} /> Cancelar pedido
            </button>
          )}

          {savedMessage && (
            <div className="flex items-start gap-3 rounded-2xl bg-[var(--brand-soft)] p-4 text-sm text-[var(--brand-strong)]">
              <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
              <p><strong className="block">Pedido guardado</strong>Ya aparece en el resumen de las administradoras.</p>
            </div>
          )}
        </aside>
      </div>

      <p className="mt-5 text-center text-xs text-[var(--muted)]">
        Modo demostración: los horarios se muestran, pero aún no bloquean acciones.
      </p>
    </main>
  );
}
