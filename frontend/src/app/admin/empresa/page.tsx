"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Plus,
  Send,
  UsersRound,
} from "lucide-react";
import { useDemo } from "@/components/demo-provider";
import { baseOrderCounts, fictionalWorkerCount } from "@/lib/demo-data";
import type { SideChoice } from "@/types/domain";

type FormMode = "training" | "extra" | "exception";

export default function CompanyAdminPage() {
  const {
    menus,
    orders,
    trainingGroups,
    extras,
    exceptions,
    addTrainingGroup,
    addExtra,
    requestException,
  } = useDemo();
  const [activeDayId, setActiveDayId] = useState(menus[0].id);
  const [mode, setMode] = useState<FormMode>("training");
  const [message, setMessage] = useState("");
  const activeDay = menus.find((day) => day.id === activeDayId) ?? menus[0];
  const activeTraining = trainingGroups.filter((group) => group.dayId === activeDayId);
  const activeExtras = extras.filter((extra) => extra.dayId === activeDayId);
  const activeExceptions = exceptions.filter((request) => request.dayId === activeDayId);

  const totals = useMemo(() => {
    const workerOrders = Object.values(orders).filter(
      (order) => order.dayId === activeDayId,
    ).length;
    const baseWorkers = Object.values(baseOrderCounts[activeDayId] ?? {}).reduce(
      (sum, count) => sum + count,
      0,
    );
    const trainees = activeTraining.reduce(
      (sum, group) => sum + group.attendeeCount,
      0,
    );
    const approvedExceptions = activeExceptions.filter(
      (request) => request.status === "approved",
    ).length;
    return {
      workerOrders: baseWorkers + workerOrders,
      trainees,
      total: baseWorkers + workerOrders + trainees + activeExtras.length + approvedExceptions,
    };
  }, [activeDayId, activeExceptions, activeExtras.length, activeTraining, orders]);

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const menuOptionId = String(form.get("menuOptionId"));
    const personLabel = String(form.get("personLabel") ?? "").trim();

    if (mode === "training") {
      addTrainingGroup({
        dayId: activeDayId,
        name: personLabel,
        attendeeCount: Number(form.get("attendeeCount")),
        menuOptionId,
        side: String(form.get("side")) as SideChoice,
        bread: form.get("bread") === "on",
        tea: form.get("tea") === "on",
      });
      setMessage("Capacitación incorporada al conteo.");
    } else if (mode === "extra") {
      addExtra({ dayId: activeDayId, personLabel, menuOptionId });
      setMessage("Colación extra agregada correctamente.");
    } else {
      requestException({
        dayId: activeDayId,
        personLabel,
        menuOptionId,
        reason: String(form.get("reason") ?? "Solicitud fuera de horario"),
      });
      setMessage("Solicitud enviada a la administradora proveedora.");
    }

    event.currentTarget.reset();
  }

  return (
    <main className="page-shell">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Panel empresa</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
            Administración Securitas
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Gestiona trabajadores sin pedido, capacitaciones, personal externo y
            solicitudes que requieren autorización.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-extrabold text-[var(--accent)]">
          <Building2 size={15} /> Vista administradora
        </span>
      </div>

      <div className="mt-7 flex gap-2 overflow-x-auto pb-2">
        {menus.map((day) => (
          <button
            key={day.id}
            type="button"
            onClick={() => {
              setActiveDayId(day.id);
              setMessage("");
            }}
            className={`focus-ring min-w-24 rounded-xl border px-4 py-2.5 text-sm font-bold ${
              activeDayId === day.id
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-[var(--line)] bg-white text-[var(--muted)]"
            }`}
          >
            {day.dayShort} {day.dayNumber}
          </button>
        ))}
      </div>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={UsersRound} label="Trabajadores" value={totals.workerOrders} note={`de ${fictionalWorkerCount} activos`} />
        <MetricCard icon={GraduationCap} label="Alumnos" value={totals.trainees} note={`${activeTraining.length} bloque(s)`} />
        <MetricCard icon={Plus} label="Extras" value={activeExtras.length} note="personal externo" />
        <MetricCard icon={CheckCircle2} label="Total del día" value={totals.total} note="confirmadas" highlight />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <section className="card p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Registro manual</p>
              <h2 className="mt-1 text-xl font-black">Agregar al conteo</h2>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--warning)]">
              <Clock3 size={14} /> {activeDay.dateLabel}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 rounded-xl bg-[var(--surface-muted)] p-1">
            {[
              ["training", "Capacitación"],
              ["extra", "Extra"],
              ["exception", "Excepcional"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value as FormMode);
                  setMessage("");
                }}
                className={`focus-ring rounded-lg px-2 py-2.5 text-xs font-extrabold ${
                  mode === value
                    ? "bg-white text-[var(--brand)] shadow-sm"
                    : "text-[var(--muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form key={mode} onSubmit={submitForm} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold text-[var(--muted)]">
                {mode === "training" ? "Nombre de la capacitación" : "Nombre o referencia"}
              </span>
              <input
                name="personLabel"
                required
                placeholder={mode === "training" ? "Ej. Inducción guardias agosto" : "Ej. Visita técnica"}
                className="focus-ring min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 outline-none"
              />
            </label>

            {mode === "training" && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-extrabold text-[var(--muted)]">
                  Cantidad de alumnos en este menú
                </span>
                <input
                  name="attendeeCount"
                  type="number"
                  min="1"
                  max="200"
                  required
                  defaultValue="30"
                  className="focus-ring min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 outline-none"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold text-[var(--muted)]">Menú</span>
              <select name="menuOptionId" required className="focus-ring min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 outline-none">
                {activeDay.options.filter((option) => option.available).map((option) => (
                  <option key={option.id} value={option.id}>{option.label} · {option.description}</option>
                ))}
              </select>
            </label>

            {mode === "training" && (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-extrabold text-[var(--muted)]">Acompañamiento del bloque</span>
                  <select name="side" className="focus-ring min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 outline-none">
                    <option value="ensalada">Ensalada</option>
                    <option value="postre">Fruta/postre</option>
                    <option value="ninguno">Ninguno</option>
                  </select>
                </label>
                <div className="flex gap-5 text-sm font-bold">
                  <label className="flex items-center gap-2"><input name="bread" type="checkbox" className="size-4 accent-[var(--brand)]" /> Pan</label>
                  <label className="flex items-center gap-2"><input name="tea" type="checkbox" className="size-4 accent-[var(--brand)]" /> Té</label>
                </div>
              </>
            )}

            {mode === "exception" && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-extrabold text-[var(--muted)]">Motivo</span>
                <textarea name="reason" required rows={3} placeholder="Explica por qué se solicita fuera del proceso normal" className="focus-ring w-full resize-none rounded-xl border border-[var(--line)] bg-white p-3.5 outline-none" />
              </label>
            )}

            <button type="submit" className="focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 font-extrabold text-white hover:bg-[var(--brand-strong)]">
              {mode === "exception" ? <Send size={17} /> : <Plus size={17} />}
              {mode === "training" ? "Agregar capacitación" : mode === "extra" ? "Agregar colación extra" : "Enviar para aprobación"}
            </button>
          </form>

          {message && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--brand-soft)] p-3 text-sm font-bold text-[var(--brand-strong)]">
              <CheckCircle2 size={17} /> {message}
            </p>
          )}
        </section>

        <section className="space-y-5">
          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Capacitaciones</p>
                <h2 className="mt-1 text-lg font-black">Grupos registrados</h2>
              </div>
              <GraduationCap className="text-[var(--brand)]" />
            </div>
            <div className="mt-4 space-y-3">
              {activeTraining.length === 0 ? (
                <p className="rounded-xl bg-[var(--surface-muted)]/60 p-4 text-sm text-[var(--muted)]">No hay capacitaciones para este día.</p>
              ) : (
                activeTraining.map((group) => {
                  const menuOption = activeDay.options.find((option) => option.id === group.menuOptionId);
                  return (
                    <div key={group.id} className="rounded-xl border border-[var(--line)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-extrabold">{group.name}</p><p className="mt-1 text-xs text-[var(--muted)]">{menuOption?.description}</p></div>
                        <span className="rounded-lg bg-[var(--brand-soft)] px-2.5 py-1 text-sm font-black text-[var(--brand)]">{group.attendeeCount}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div><p className="eyebrow">Excepciones</p><h2 className="mt-1 text-lg font-black">Estado de solicitudes</h2></div>
              <AlertCircle className="text-[var(--accent)]" />
            </div>
            <div className="mt-4 space-y-3">
              {activeExceptions.map((request) => (
                <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] p-3.5">
                  <div><p className="text-sm font-extrabold">{request.personLabel}</p><p className="mt-0.5 text-xs text-[var(--muted)]">{request.createdAt}</p></div>
                  <Status status={request.status} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ icon: Icon, label, value, note, highlight = false }: { icon: typeof UsersRound; label: string; value: number; note: string; highlight?: boolean }) {
  return (
    <article className={`card p-5 ${highlight ? "card-strong" : ""}`}>
      <div className="flex items-center justify-between"><span className={`grid size-9 place-items-center rounded-xl ${highlight ? "bg-white/15" : "bg-[var(--herb-soft)] text-[var(--herb)]"}`}><Icon size={18} /></span><span className={`text-xs font-bold ${highlight ? "text-white/70" : "text-[var(--muted)]"}`}>{note}</span></div>
      <p className="mt-5 text-3xl font-black tracking-[-0.04em]">{value}</p>
      <p className={`mt-1 text-sm font-bold ${highlight ? "text-white/80" : "text-[var(--muted)]"}`}>{label}</p>
    </article>
  );
}

function Status({ status }: { status: "pending" | "approved" | "rejected" }) {
  const styles = { pending: "bg-amber-50 text-amber-700", approved: "bg-emerald-50 text-emerald-700", rejected: "bg-red-50 text-red-700" };
  const labels = { pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada" };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${styles[status]}`}>{labels[status]}</span>;
}
