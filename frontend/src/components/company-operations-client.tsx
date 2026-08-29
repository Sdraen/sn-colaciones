"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, BarChart3, Building2, GraduationCap, Plus, Send, UsersRound } from "lucide-react";
import { OperationsReports } from "@/components/provider-reports";
import { browserApiRequest } from "@/lib/api/client";
import type { CompanyOperationsDto, ExceptionDto, MenuWeekDto, NotificationDto, OrderDto, OrdersReportDto, SideChoice } from "@/lib/api/contracts";
import { formatChileanTabDate } from "@/lib/date-format";

type Mode = "training" | "same_day" | "exception";

export function CompanyOperationsClient({ menu, initialOperations, initialReport, notifications, nowIso }: { menu: MenuWeekDto | null; initialOperations: CompanyOperationsDto | null; initialReport: OrdersReportDto; notifications: NotificationDto[]; nowIso: string }) {
  const [operations, setOperations] = useState(initialOperations);
  const [activeDayId, setActiveDayId] = useState(menu?.days[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("training");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const activeDay = menu?.days.find((day) => day.id === activeDayId);
  const orders = operations?.orders ?? [];
  const activeOrders = orders.filter((order) => order.serviceDayId === activeDayId && order.status === "confirmed");
  const activeExceptions = (operations?.exceptions ?? []).filter((item) => item.serviceDayId === activeDayId);
  const trainingMenu = activeDay?.options.find((option) => option.trainingMenu && option.visible);
  const now = new Date(nowIso);
  const blocked = operations?.calendarBlocks.some((block) => activeDay && activeDay.serviceDate >= block.startsOn && activeDay.serviceDate <= block.endsOn && ["holiday","vacation","no_service"].includes(block.kind)) ?? false;
  const trainingOpen = Boolean(activeDay && !blocked && isWeekday(activeDay.serviceDate) && localDate(now) === activeDay.serviceDate && localMinutes(now) <= 9 * 60 && trainingMenu);
  const sameDayOpen = Boolean(activeDay && now >= new Date(activeDay.sameDayOpensAt) && now < new Date(activeDay.sameDayClosesAt));
  const exceptionOpen = Boolean(activeDay && now >= new Date(activeDay.sameDayClosesAt) && now <= new Date(activeDay.deliveryClosesAt));
  const modeOpen = mode === "training" ? trainingOpen : mode === "same_day" ? sameDayOpen : exceptionOpen;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!activeDay || !modeOpen) return;
    const form = new FormData(event.currentTarget); const complement = String(form.get("complement"));
    const common = { serviceDayId: activeDay.id, menuOptionId: mode === "training" ? trainingMenu?.id : String(form.get("menuOptionId")), side: String(form.get("side")) as SideChoice, bread: complement === "bread", tea: complement === "tea" };
    setSaving(true); setError("");
    try {
      if (mode === "training") {
        const name = String(form.get("name")); const attendeeCount = Number(form.get("quantity"));
        const order = await browserApiRequest<OrderDto>("/api/v1/company/training-sessions", { method: "POST", body: JSON.stringify({ ...common, name, attendeeCount }) });
        setOperations((current) => current ? { ...current, orders: [order, ...current.orders], trainingSessions: [{ id: order.trainingSessionId ?? order.id, name, serviceDate: activeDay.serviceDate, expectedAttendees: attendeeCount, createdAt: order.createdAt }, ...current.trainingSessions] } : current);
      } else if (mode === "same_day") {
        const order = await browserApiRequest<OrderDto>("/api/v1/company/extras", { method: "POST", body: JSON.stringify({ ...common, beneficiaryLabel: String(form.get("name")) }) });
        setOperations((current) => current ? { ...current, orders: [order, ...current.orders] } : current);
      } else {
        const request = await browserApiRequest<ExceptionDto>("/api/v1/company/exceptions", { method: "POST", body: JSON.stringify({ ...common, beneficiaryLabel: String(form.get("name")), reason: String(form.get("reason")) }) });
        setOperations((current) => current ? { ...current, exceptions: [request, ...current.exceptions] } : current);
      }
      event.currentTarget.reset(); setMessage("Registro guardado correctamente.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible guardar"); }
    finally { setSaving(false); }
  }

  return <main className="page-shell"><div className="flex flex-wrap justify-between gap-4"><div><p className="eyebrow">Panel empresa</p><h1 className="mt-2 text-3xl font-black">Administración Securitas</h1><p className="mt-2 text-sm text-[var(--muted)]">Capacitaciones, ingresos del día, extraordinarias y reportes.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-extrabold"><Building2 size={15} /> Acceso autorizado</span></div>
    {!menu || !operations ? <section className="card mt-7 p-8 text-center"><h2 className="text-xl font-black">No hay un menú semanal publicado</h2><p className="mt-2 text-sm text-[var(--muted)]">La proveedora debe publicar el menú antes de registrar operaciones.</p></section> : <>
      <div className="mt-7 flex gap-2 overflow-x-auto">{menu.days.map((day) => <button key={day.id} type="button" onClick={() => setActiveDayId(day.id)} className={`min-w-36 rounded-xl border px-4 py-2.5 font-bold ${day.id === activeDayId ? "bg-[var(--brand)] text-white" : "bg-white"}`}>{formatChileanTabDate(day.serviceDate)}</button>)}</div>
      <section className="mt-5 grid gap-4 sm:grid-cols-3"><Metric icon={UsersRound} label="Colaciones operativas" value={activeOrders.reduce((sum, order) => sum + order.quantity, 0)} /><Metric icon={GraduationCap} label="Capacitaciones" value={activeOrders.filter((order) => order.kind === "training").reduce((sum, order) => sum + order.quantity, 0)} /><Metric icon={AlertCircle} label="Extraordinarias pendientes" value={activeExceptions.filter((item) => item.status === "pending").length} /></section>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_.9fr]"><section className="card p-6"><p className="eyebrow">Registro autorizado</p><h2 className="mt-1 text-xl font-black">Agregar al conteo</h2><div className="mt-5 grid grid-cols-3 rounded-xl bg-[var(--surface-muted)] p-1">{([["training","Capacitación"],["same_day","08:00–11:00"],["exception","11:00–12:00"]] as const).map(([value,label]) => <button key={value} type="button" onClick={() => { setMode(value); setMessage(""); setError(""); }} className={`rounded-lg px-2 py-2.5 text-xs font-extrabold ${mode === value ? "bg-white text-[var(--brand)] shadow-sm" : "text-[var(--muted)]"}`}>{label}</button>)}</div><p className={`mt-4 rounded-xl p-3 text-xs font-bold ${modeOpen ? "bg-[var(--herb-soft)] text-[var(--herb-strong)]" : "bg-[var(--accent-soft)] text-[var(--warning)]"}`}>{modeOpen ? "Ventana habilitada." : "Esta ventana no está disponible en este momento."}</p>
      <form onSubmit={submit} className="mt-5 space-y-4"><input name="name" required minLength={2} placeholder={mode === "training" ? "Nombre de la capacitación" : "Persona o referencia"} className="min-h-12 w-full rounded-xl border border-[var(--line)] px-3" />{mode === "training" ? <><input name="quantity" type="number" min="1" max="500" required placeholder="Cantidad de alumnos" className="min-h-12 w-full rounded-xl border border-[var(--line)] px-3" /><p className="rounded-xl bg-[var(--surface-muted)] p-3 text-sm font-bold">Menú: {trainingMenu ? `${trainingMenu.label} · ${trainingMenu.description}` : "No definido"}</p></> : <select name="menuOptionId" required className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3">{activeDay?.options.filter((option) => option.visible).map((option) => <option key={option.id} value={option.id}>{option.label} · {option.description}</option>)}</select>}<select name="side" required className="min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3"><option value="ensalada">Ensalada</option><option value="postre">Postre</option><option value="ninguno">Ninguno</option></select><fieldset><legend className="text-xs font-extrabold">Pan o té</legend><div className="mt-2 grid grid-cols-2 gap-3">{[["bread","Pan"],["tea","Té"]].map(([value,label]) => <label key={value} className="rounded-xl border border-[var(--line)] p-3 font-bold"><input name="complement" type="radio" value={value} required className="mr-2" />{label}</label>)}</div></fieldset>{mode === "exception" ? <textarea name="reason" required minLength={5} rows={3} placeholder="Motivo de la solicitud" className="w-full rounded-xl border border-[var(--line)] p-3" /> : null}<button type="submit" disabled={!modeOpen || saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] font-extrabold text-white disabled:opacity-40">{mode === "exception" ? <Send size={17} /> : <Plus size={17} />}{saving ? "Guardando…" : "Guardar"}</button></form>{message ? <p role="status" className="mt-3 rounded-xl bg-[var(--herb-soft)] p-3 text-sm font-bold">{message}</p> : null}{error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">{error}</p> : null}</section>
      <section className="space-y-5"><div className="card p-5"><h2 className="font-black">Solicitudes extraordinarias</h2><div className="mt-4 space-y-3">{activeExceptions.length ? activeExceptions.map((item) => <div key={item.id} className="rounded-xl border border-[var(--line)] p-3"><div className="flex justify-between gap-3"><strong>{item.beneficiaryLabel}</strong><span className="text-xs font-bold">{statusLabel(item.status)}</span></div>{item.resolutionNote ? <p className="mt-2 text-xs text-[var(--muted)]">{item.resolutionNote}</p> : null}</div>) : <p className="text-sm text-[var(--muted)]">Sin solicitudes para el día.</p>}</div></div><div className="card p-5"><h2 className="font-black">Notificaciones</h2><div className="mt-3 space-y-2">{notifications.slice(0,5).map((item) => <p key={item.id} className="rounded-xl bg-[var(--surface-muted)] p-3 text-sm"><strong className="block">{item.title}</strong>{item.message}</p>)}</div></div></section></div>
    </>}
    <section id="reportes" className="scroll-mt-24"><div className="mt-10 flex items-center gap-2"><BarChart3 size={20} /><h2 className="text-xl font-black">Reportes</h2></div><OperationsReports endpoint="/api/v1/company/reports" initialReport={initialReport} /></section></main>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof UsersRound; label: string; value: number }) { return <article className="card p-5"><Icon size={19} className="text-[var(--herb)]" /><p className="mt-3 text-3xl font-black">{value}</p><p className="text-sm font-bold text-[var(--muted)]">{label}</p></article>; }
function isWeekday(date: string) { const day = new Date(`${date}T12:00:00Z`).getUTCDay(); return day >= 1 && day <= 5; }
function localDate(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function localMinutes(date: Date) { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date); const values = Object.fromEntries(parts.map((part) => [part.type, part.value])); return Number(values.hour) * 60 + Number(values.minute); }
function statusLabel(status: ExceptionDto["status"]) { return status === "pending" ? "Pendiente" : status === "approved" ? "Aprobada" : "Rechazada"; }
