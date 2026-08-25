"use client";

import { useMemo, useState } from "react";
import {
  BellRing,
  Check,
  ChefHat,
  Clock3,
  PackageCheck,
  Save,
  Salad,
  UsersRound,
  X,
} from "lucide-react";
import { useDemo } from "@/components/demo-provider";
import { baseOrderCounts } from "@/lib/demo-data";

export default function ProviderAdminPage() {
  const {
    menus,
    orders,
    extras,
    trainingGroups,
    exceptions,
    updateMenuOption,
    resolveException,
  } = useDemo();
  const [activeDayId, setActiveDayId] = useState(menus[0].id);
  const [published, setPublished] = useState(false);
  const activeDay = menus.find((day) => day.id === activeDayId) ?? menus[0];

  const summary = useMemo(() => {
    const optionCounts = { ...(baseOrderCounts[activeDayId] ?? {}) };
    const activeOrders = Object.values(orders).filter((order) => order.dayId === activeDayId);
    for (const order of activeOrders) optionCounts[order.menuOptionId] = (optionCounts[order.menuOptionId] ?? 0) + 1;
    for (const group of trainingGroups.filter((item) => item.dayId === activeDayId)) optionCounts[group.menuOptionId] = (optionCounts[group.menuOptionId] ?? 0) + group.attendeeCount;
    for (const extra of extras.filter((item) => item.dayId === activeDayId)) optionCounts[extra.menuOptionId] = (optionCounts[extra.menuOptionId] ?? 0) + 1;
    for (const request of exceptions.filter((item) => item.dayId === activeDayId && item.status === "approved")) optionCounts[request.menuOptionId] = (optionCounts[request.menuOptionId] ?? 0) + 1;
    const total = Object.values(optionCounts).reduce((sum, count) => sum + count, 0);
    const salads = 14 + activeOrders.filter((order) => order.side === "ensalada").length + trainingGroups.filter((group) => group.dayId === activeDayId && group.side === "ensalada").reduce((sum, group) => sum + group.attendeeCount, 0);
    const desserts = 12 + activeOrders.filter((order) => order.side === "postre").length + trainingGroups.filter((group) => group.dayId === activeDayId && group.side === "postre").reduce((sum, group) => sum + group.attendeeCount, 0);
    const breads = 14 + activeOrders.filter((order) => order.bread).length + trainingGroups.filter((group) => group.dayId === activeDayId && group.bread).reduce((sum, group) => sum + group.attendeeCount, 0);
    return { optionCounts, total, salads, desserts, breads };
  }, [activeDayId, exceptions, extras, orders, trainingGroups]);

  const pending = exceptions.filter((request) => request.status === "pending");

  return (
    <main className="page-shell">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Panel proveedor</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Producción del día</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Pedidos anticipados, capacitaciones, extras y excepciones aprobadas en un solo conteo.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-soft)] px-3 py-2 text-xs font-extrabold text-[var(--brand)]"><ChefHat size={15} /> Vista proveedora</span>
      </div>

      <div className="mt-7 flex gap-2 overflow-x-auto pb-2">
        {menus.map((day) => (
          <button key={day.id} type="button" onClick={() => { setActiveDayId(day.id); setPublished(false); }} className={`focus-ring min-w-24 rounded-xl border px-4 py-2.5 text-sm font-bold ${activeDayId === day.id ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-white text-[var(--muted)]"}`}>{day.dayShort} {day.dayNumber}</button>
        ))}
      </div>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={PackageCheck} label="Total colaciones" value={summary.total} strong />
        <SummaryCard icon={Salad} label="Ensaladas" value={summary.salads} />
        <SummaryCard icon={UsersRound} label="Fruta o postre" value={summary.desserts} />
        <SummaryCard icon={ChefHat} label="Pan" value={summary.breads} />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="card p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="eyebrow">Resumen por preparación</p><h2 className="mt-1 text-xl font-black">{activeDay.dateLabel}</h2></div>
            <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--warning)]"><Clock3 size={14} /> Corte 22:00 · Publicación 08:00</span>
          </div>
          <div className="mt-6 space-y-3">
            {activeDay.options.filter((option) => option.available).map((option) => {
              const count = summary.optionCounts[option.id] ?? 0;
              const percentage = summary.total > 0 ? Math.max(4, Math.round((count / summary.total) * 100)) : 0;
              return (
                <div key={option.id} className="rounded-2xl border border-[var(--line)] p-4">
                  <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-wider text-[var(--brand)]">{option.label}</p><p className="mt-1 font-bold">{option.description}</p></div><span className="text-2xl font-black">{count}</span></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${percentage}%` }} /></div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-5">
          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Solicitudes excepcionales</p><h2 className="mt-1 text-lg font-black">Requieren decisión</h2></div><span className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><BellRing size={20} /></span></div>
            <div className="mt-4 space-y-3">
              {pending.length === 0 ? <p className="rounded-xl bg-[var(--surface-muted)]/60 p-4 text-sm text-[var(--muted)]">No hay solicitudes pendientes.</p> : pending.map((request) => {
                const requestDay = menus.find((day) => day.id === request.dayId);
                const menuOption = requestDay?.options.find((option) => option.id === request.menuOptionId);
                return (
                  <article key={request.id} className="rounded-2xl border border-[var(--line)] p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-extrabold">{request.personLabel}</p><p className="mt-1 text-xs text-[var(--muted)]">{requestDay?.dayShort} {requestDay?.dayNumber} · {menuOption?.description}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold text-amber-700">Pendiente</span></div>
                    <p className="mt-3 rounded-xl bg-[var(--surface-muted)]/60 p-3 text-xs leading-5 text-[var(--muted)]">{request.reason}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => resolveException(request.id, "rejected")} className="focus-ring flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-red-100 text-xs font-extrabold text-red-700 hover:bg-red-50"><X size={15} /> Rechazar</button><button type="button" onClick={() => resolveException(request.id, "approved")} className="focus-ring flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--herb)] text-xs font-extrabold text-white hover:bg-[var(--herb-strong)]"><Check size={15} /> Aprobar</button></div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="card p-5 sm:p-6">
            <div><p className="eyebrow">Menú publicado</p><h2 className="mt-1 text-lg font-black">Editar alternativas</h2></div>
            <div className="mt-4 space-y-3">
              {activeDay.options.map((option) => (
                <div key={option.id} className="rounded-xl border border-[var(--line)] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2"><label htmlFor={`menu-${option.id}`} className="text-xs font-extrabold text-[var(--brand)]">{option.label}</label><label className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted)]"><input type="checkbox" checked={option.available} onChange={(event) => updateMenuOption(activeDayId, option.id, { available: event.target.checked })} className="accent-[var(--brand)]" /> Visible</label></div>
                  <input id={`menu-${option.id}`} value={option.description} onChange={(event) => updateMenuOption(activeDayId, option.id, { description: event.target.value })} className="focus-ring w-full rounded-lg bg-[var(--surface-muted)]/60 px-3 py-2 text-sm font-semibold outline-none" />
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setPublished(true)} className="focus-ring mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--herb)] text-sm font-extrabold text-white hover:bg-[var(--herb-strong)]"><Save size={16} /> Publicar cambios</button>
            {published && <p className="mt-3 flex items-center gap-2 text-xs font-bold text-[var(--brand)]"><Check size={15} /> Menú actualizado en la vista del trabajador.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ icon: Icon, label, value, strong = false }: { icon: typeof PackageCheck; label: string; value: number; strong?: boolean }) {
  return <article className={`card p-5 ${strong ? "card-strong" : ""}`}><span className={`grid size-9 place-items-center rounded-xl ${strong ? "bg-white/15" : "bg-[var(--herb-soft)] text-[var(--herb)]"}`}><Icon size={18} /></span><p className="mt-5 text-3xl font-black tracking-[-0.04em]">{value}</p><p className={`mt-1 text-sm font-bold ${strong ? "text-white/75" : "text-[var(--muted)]"}`}>{label}</p></article>;
}
