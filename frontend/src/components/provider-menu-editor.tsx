"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { browserApiRequest } from "@/lib/api/client";
import type { MenuWeekDto } from "@/lib/api/contracts";
import { formatChileanDate, formatChileanDateWithWeekday } from "@/lib/date-format";

type DraftOption = {
  category: string;
  label: string;
  description: string;
  dessert: string | null;
  beverage: string | null;
  notes: string | null;
  capacity: number | null;
  trainingMenu: boolean;
  availableForWorkers: boolean;
  visible: boolean;
  sortOrder: number;
};

type DraftDay = {
  serviceDate: string;
  disabled: boolean;
  options: DraftOption[];
};

type Feedback = { kind: "success" | "error"; text: string } | null;

const MENU_ALTERNATIVES = [
  { label: "Principal 1", category: "principal" },
  { label: "Principal 2", category: "principal" },
  { label: "Vegetariano", category: "vegetariano" },
  { label: "Hipocalórico", category: "hipocalorico" },
  { label: "Sándwich", category: "sandwich" },
  { label: "Sándwich vegetariano", category: "vegetariano" },
  { label: "Burger", category: "especial" },
  { label: "Burger vegetariana", category: "vegetariano" },
  { label: "Empanadas", category: "especial" },
  { label: "Handroll", category: "handroll" },
  { label: "Handroll vegetariano", category: "vegetariano" },
] as const;

export function ProviderMenuEditor({
  initialMenu,
  startsOn,
  periodLabel,
  currentWeek = false,
  onMenuChange,
}: {
  initialMenu: MenuWeekDto | null;
  startsOn: string;
  periodLabel: string;
  currentWeek?: boolean;
  onMenuChange?: (menu: MenuWeekDto | null) => void;
}) {
  const [menu, setMenu] = useState(initialMenu);
  const [days, setDays] = useState<DraftDay[]>(() =>
    initialMenu ? toDraftDays(initialMenu) : createEmptyWeek(startsOn),
  );
  const [editingDay, setEditingDay] = useState<number | null>(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const serviceDays = days;
  const readyDays = serviceDays.filter((day) => day.disabled || isDayComplete(day)).length;
  const trainingDraft = days
    .flatMap((day) => day.options)
    .find((option) => option.trainingMenu && !option.availableForWorkers);
  const trainingComplete = !trainingDraft || (
    trainingDraft.label.trim().length >= 2 && trainingDraft.description.trim().length >= 3
  );
  const weekComplete = readyDays === serviceDays.length && trainingComplete;
  const published = Boolean(menu?.publishedAt);

  function updateDay(dayIndex: number, patch: Partial<DraftDay>) {
    setDays((current) =>
      current.map((day, index) => (index === dayIndex ? { ...day, ...patch } : day)),
    );
    setDirty(true);
    setFeedback(null);
  }

  function updateOption(
    dayIndex: number,
    optionIndex: number,
    patch: Partial<DraftOption>,
  ) {
    setDays((current) =>
      current.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              options: day.options.map((option, currentIndex) =>
                currentIndex === optionIndex ? { ...option, ...patch } : option,
              ),
            }
          : day,
      ),
    );
    setDirty(true);
    setFeedback(null);
  }

  const trainingMenu = trainingDraft;

  function updateTrainingMenu(patch: Partial<DraftOption> | null) {
    setDays((current) => current.map((day, index) => {
      const regularOptions = day.options
        .filter((option) => option.availableForWorkers)
        .map((option) => ({ ...option, trainingMenu: false }));
      if (patch === null || index >= 5) return { ...day, options: regularOptions };
      const existing = day.options.find(
        (option) => option.trainingMenu && !option.availableForWorkers,
      );
      const base = existing ?? trainingOption();
      return {
        ...day,
        options: [...regularOptions, { ...base, ...patch, trainingMenu: true, availableForWorkers: false }],
      };
    }));
    setDirty(true);
    setFeedback(null);
  }

  async function persistDraft() {
    const endpoint = menu
      ? `/api/v1/provider/menu-weeks/${menu.id}`
      : "/api/v1/provider/menu-weeks";
    const saved = await browserApiRequest<MenuWeekDto>(endpoint, {
      method: menu ? "PUT" : "POST",
      body: JSON.stringify({ startsOn, days }),
    });
    setMenu(saved);
    onMenuChange?.(saved);
    setDays(toDraftDays(saved));
    setDirty(false);
    return saved;
  }

  async function saveDraft() {
    setSaving(true);
    setFeedback(null);
    try {
      await persistDraft();
      setFeedback({ kind: "success", text: "Borrador semanal guardado." });
    } catch (error) {
      setFeedback({ kind: "error", text: errorMessage(error, "No fue posible guardar el menú") });
    } finally {
      setSaving(false);
    }
  }

  async function publishWeek() {
    setSaving(true);
    setFeedback(null);
    try {
      const saved = dirty || !menu ? await persistDraft() : menu;
      const publishedMenu = await browserApiRequest<MenuWeekDto>(
        `/api/v1/provider/menu-weeks/${saved.id}/publish`,
        { method: "POST" },
      );
      setMenu(publishedMenu);
      onMenuChange?.(publishedMenu);
      setDays(toDraftDays(publishedMenu));
      setEditingDay(null);
      setFeedback({
        kind: "success",
        text: "Semana publicada. Los trabajadores ya pueden verla.",
      });
    } catch (error) {
      setFeedback({ kind: "error", text: errorMessage(error, "No fue posible publicar") });
    } finally {
      setSaving(false);
    }
  }

  async function copyPreviousWeek() {
    setSaving(true);
    setFeedback(null);
    try {
      const copied = await browserApiRequest<MenuWeekDto>(
        "/api/v1/provider/menu-weeks/copy",
        {
          method: "POST",
          body: JSON.stringify({ targetStartsOn: startsOn }),
        },
      );
      setMenu(copied);
      onMenuChange?.(copied);
      setDays(toDraftDays(copied));
      setDirty(false);
      setEditingDay(0);
      setFeedback({ kind: "success", text: "Semana anterior copiada como borrador." });
    } catch (error) {
      setFeedback({ kind: "error", text: errorMessage(error, "No fue posible copiar la semana") });
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft() {
    if (!menu || published) return;
    setSaving(true);
    setFeedback(null);
    try {
      await browserApiRequest(`/api/v1/provider/menu-weeks/${menu.id}`, {
        method: "DELETE",
      });
      setMenu(null);
      onMenuChange?.(null);
      setDays(createEmptyWeek(startsOn));
      setDirty(false);
      setEditingDay(0);
      setConfirmingDelete(false);
      setFeedback({ kind: "success", text: "Borrador eliminado." });
    } catch (error) {
      setFeedback({ kind: "error", text: errorMessage(error, "No fue posible eliminar") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="menu-editor-enter space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Semana del {formatChileanDate(startsOn)}</p>
          <h2 className="mt-1 text-2xl font-black">Menú de la {periodLabel}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {published
              ? "Esta semana ya está publicada y quedó protegida contra cambios."
              : currentWeek
                ? `${readyDays} de 7 días preparados. Puedes cargarla aunque la semana ya haya comenzado.`
                : `${readyDays} de 7 días preparados. Completa cada día y luego publica.`}
          </p>
        </div>
        {!menu && !published ? (
          <button
            type="button"
            onClick={copyPreviousWeek}
            disabled={saving}
            className="menu-action inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-extrabold text-[var(--ink)] shadow-sm hover:bg-[var(--surface-muted)] disabled:opacity-50 sm:w-auto"
          >
            <Copy size={17} /> Copiar semana anterior
          </button>
        ) : null}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]" aria-hidden="true">
        <div
          className="menu-progress-fill h-full rounded-full bg-[var(--herb)]"
          style={{ width: `${(readyDays / serviceDays.length) * 100}%` }}
        />
      </div>

      {feedback ? (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`menu-feedback-enter rounded-xl p-3 text-sm font-bold ${
            feedback.kind === "error"
              ? "bg-red-50 text-[var(--danger)]"
              : "bg-[var(--herb-soft)] text-[var(--herb-strong)]"
          }`}
        >
          {feedback.text}
        </p>
      ) : null}

      <TrainingMenuEditor
        option={trainingMenu}
        published={published}
        onEnable={() => updateTrainingMenu(trainingOption())}
        onDisable={() => updateTrainingMenu(null)}
        onChange={(patch) => updateTrainingMenu(patch)}
      />

      <div className="menu-week-list card divide-y divide-[var(--line)] overflow-hidden">
        {serviceDays.map((day, dayIndex) => {
          const complete = day.disabled || isDayComplete(day);
          const expanded = editingDay === dayIndex && !published;
          const description = day.disabled
            ? "Sin servicio"
            : day.options.find((option) => option.visible && option.availableForWorkers)?.description.trim() ||
              "Preparación pendiente";

          return (
            <div key={day.serviceDate}>
              <button
                type="button"
                onClick={() => {
                  setEditingDay(expanded ? null : dayIndex);
                }}
                aria-expanded={expanded}
                aria-controls={`menu-day-${day.serviceDate}`}
                disabled={published}
                className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-left transition-colors duration-200 hover:bg-[var(--surface-muted)] disabled:cursor-default disabled:hover:bg-white sm:px-5"
              >
                <span
                  className={`grid size-8 place-items-center rounded-full transition-all duration-300 ${
                    complete
                      ? "menu-status-ready bg-[var(--herb-soft)] text-[var(--herb-strong)]"
                      : "bg-[var(--brand-soft)] text-[var(--brand)]"
                  }`}
                >
                  {complete ? <Check size={17} /> : <AlertTriangle size={16} />}
                </span>
                <span className="min-w-0">
                  <strong className="block capitalize">
                    {formatChileanDateWithWeekday(day.serviceDate)}
                  </strong>
                  <span className="mt-0.5 block truncate text-sm text-[var(--muted)]">
                    {description}
                  </span>
                </span>
                {!published ? (
                  <span className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand-soft)] px-2.5 py-2 text-sm font-extrabold text-[var(--brand)] sm:px-3">
                    <Pencil size={15} className="hidden sm:block" />
                    <span className="hidden sm:inline">{complete ? "Editar" : "Agregar"}</span>
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className={`menu-day-chevron transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                    />
                  </span>
                ) : null}
              </button>

              <div
                id={`menu-day-${day.serviceDate}`}
                className={`menu-collapsible grid ${
                  expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
                aria-hidden={!expanded}
                inert={!expanded}
              >
                <div className="min-h-0 overflow-hidden">
                  <DayEditor
                    day={day}
                    dayIndex={dayIndex}
                    onUpdateDay={updateDay}
                    onUpdateOption={updateOption}
                    onDone={() => setEditingDay(null)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!published ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="w-full sm:w-auto">
            {menu && !confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
                className="menu-action inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-extrabold text-[var(--danger)] hover:bg-red-100 disabled:opacity-50 sm:w-auto"
              >
                <Trash2 size={17} /> Eliminar borrador
              </button>
            ) : null}
            {confirmingDelete ? (
              <div className="menu-feedback-enter flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-2">
                <span className="px-2 text-sm font-bold text-[var(--danger)]">¿Eliminarlo?</span>
                <button
                  type="button"
                  onClick={deleteDraft}
                  disabled={saving}
                  className="menu-action rounded-lg bg-[var(--danger)] px-3 py-2 text-sm font-extrabold text-white"
                >
                  Sí, eliminar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="menu-action rounded-lg bg-white px-3 py-2 text-sm font-bold"
                >
                  Cancelar
                </button>
              </div>
            ) : null}
          </div>
          <div className="menu-save-actions grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={saveDraft}
              disabled={saving || !dirty}
              className="menu-action inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-3 text-sm font-extrabold text-white hover:brightness-95 disabled:opacity-40 sm:px-5 sm:text-base"
            >
              <Save size={18} className="shrink-0" />
              <span className="sm:hidden">Borrador</span>
              <span className="hidden sm:inline">Guardar borrador</span>
            </button>
            <button
              type="button"
              onClick={publishWeek}
              disabled={saving || !weekComplete}
              className="menu-action inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl bg-[var(--herb)] px-3 text-sm font-extrabold text-white hover:brightness-95 disabled:opacity-40 sm:px-5 sm:text-base"
            >
              <Send size={18} className="shrink-0" />
              <span className="sm:hidden">Publicar</span>
              <span className="hidden sm:inline">
                {dirty || !menu ? "Guardar y publicar" : "Publicar semana"}
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TrainingMenuEditor({
  option,
  published,
  onEnable,
  onDisable,
  onChange,
}: {
  option: DraftOption | undefined;
  published: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onChange: (patch: Partial<DraftOption>) => void;
}) {
  const [expanded, setExpanded] = useState(Boolean(option));

  return (
    <section className="provider-card-motion card overflow-hidden">
      <div className="grid gap-4 p-5 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Apartado independiente</p>
          <h3 className="mt-1 text-xl font-black">Menú de capacitaciones</h3>
          <p className="mt-1 text-base text-[var(--muted)]">Opcional y común para los días hábiles de esta semana.</p>
        </div>
        {!published ? (
          option ? (
            <div className="grid w-full grid-cols-[1fr_auto] gap-2 sm:flex sm:w-auto">
              <button
                type="button"
                onClick={onDisable}
                className="menu-action min-h-11 rounded-xl bg-red-50 px-4 text-sm font-extrabold text-[var(--danger)]"
              >
                Quitar menú
              </button>
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
                aria-controls="training-menu-form"
                aria-label={expanded ? "Cerrar menú de capacitaciones" : "Abrir menú de capacitaciones"}
                className="menu-action inline-flex size-11 items-center justify-center rounded-xl bg-[var(--herb-soft)] text-[var(--herb-strong)]"
              >
                <ChevronDown
                  size={20}
                  aria-hidden="true"
                  className={`menu-day-chevron transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                onEnable();
                setExpanded(true);
              }}
              className="menu-action min-h-11 w-full rounded-xl bg-[var(--herb)] px-4 text-sm font-extrabold text-white sm:min-h-10 sm:w-auto"
            >
              Agregar menú
            </button>
          )
        ) : null}
      </div>
      <div
        id="training-menu-form"
        className={`menu-collapsible grid ${
          option && expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
        aria-hidden={!option || !expanded}
        inert={!option || !expanded}
      >
        <div className="min-h-0 overflow-hidden">
          {option ? (
            <div className="grid gap-5 border-t border-[var(--line)] bg-[var(--cream)] p-5 md:grid-cols-2">
              <label className="text-base font-extrabold md:col-span-2">Preparación
                <textarea disabled={published} required value={option.description} onChange={(event) => onChange({ description: event.target.value })} rows={3} placeholder="Ej.: Espirales con salsa" className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white p-4 text-base font-normal" />
              </label>
              <label className="text-base font-extrabold">Disponibilidad estimada
                <input disabled={published} type="number" min="0" value={option.capacity ?? ""} onChange={(event) => onChange({ capacity: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Ej.: 30" className="mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base font-normal" />
              </label>
            </div>
          ) : null}
        </div>
      </div>
      {!option ? (
        <p className="border-t border-[var(--line)] p-5 text-sm text-[var(--muted)]">Si no se agrega, Securitas no podrá registrar capacitaciones para esa semana.</p>
      ) : null}
    </section>
  );
}

function DayEditor({
  day,
  dayIndex,
  onUpdateDay,
  onUpdateOption,
  onDone,
}: {
  day: DraftDay;
  dayIndex: number;
  onUpdateDay: (index: number, patch: Partial<DraftDay>) => void;
  onUpdateOption: (dayIndex: number, optionIndex: number, patch: Partial<DraftOption>) => void;
  onDone: () => void;
}) {
  const workerOptions = day.options.filter((option) => option.availableForWorkers);
  const usedLabels = new Set(workerOptions.map((option) => option.label));

  return (
    <div className="border-t border-[var(--line)] bg-[var(--cream)] px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-black">Alternativas del día</p>
          <p className="text-sm text-[var(--muted)]">Sólo ingresa el plato y su disponibilidad estimada.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-extrabold">
          <input
            type="checkbox"
            checked={day.disabled}
            onChange={(event) => onUpdateDay(dayIndex, { disabled: event.target.checked })}
            className="size-4 accent-[var(--brand)]"
          />
          Sin servicio
        </label>
      </div>

      {!day.disabled ? (
        <div className="mt-5 space-y-4">
          {day.options.map((option, optionIndex) => {
            if (!option.availableForWorkers) return null;
            const knownAlternative = MENU_ALTERNATIVES.some(
              (alternative) => alternative.label === option.label,
            );
            return (
              <article
                key={`${day.serviceDate}-${optionIndex}`}
                className="rounded-2xl border-2 border-[var(--line)] bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--brand)]">
                      Alternativa {workerOptions.indexOf(option) + 1}
                    </p>
                    <p className="mt-1 text-lg font-black">{option.label}</p>
                  </div>
                  {workerOptions.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateDay(dayIndex, {
                          options: day.options
                            .filter((_, index) => index !== optionIndex)
                            .map((item, index) => ({ ...item, sortOrder: index })),
                        })
                      }
                      className="menu-action inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-50 px-3 text-sm font-extrabold text-[var(--danger)]"
                    >
                      <Trash2 size={16} /> Eliminar
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <label className="text-base font-extrabold">
                    Tipo de alternativa
                    <select
                      value={option.label}
                      onChange={(event) => {
                        const alternative = MENU_ALTERNATIVES.find(
                          (item) => item.label === event.target.value,
                        );
                        if (alternative) {
                          onUpdateOption(dayIndex, optionIndex, {
                            label: alternative.label,
                            category: alternative.category,
                            dessert: null,
                            beverage: null,
                            notes: null,
                            visible: true,
                          });
                        }
                      }}
                      className="mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-base font-normal text-[var(--ink)]"
                    >
                      {!knownAlternative ? <option value={option.label}>{option.label}</option> : null}
                      {MENU_ALTERNATIVES.map((alternative) => (
                        <option
                          key={alternative.label}
                          value={alternative.label}
                          disabled={usedLabels.has(alternative.label) && alternative.label !== option.label}
                        >
                          {alternative.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-base font-extrabold">
                    Disponibilidad estimada
                    <input
                      type="number"
                      min="0"
                      required
                      value={option.capacity ?? ""}
                      onChange={(event) =>
                        onUpdateOption(dayIndex, optionIndex, {
                          capacity: event.target.value === "" ? null : Number(event.target.value),
                        })
                      }
                      placeholder="Ej.: 50"
                      className="mt-2 min-h-12 w-full rounded-xl border border-[var(--line)] px-4 text-base font-normal text-[var(--ink)]"
                    />
                  </label>

                  <label className="text-base font-extrabold lg:col-span-2">
                    Plato o preparación
                    <textarea
                      value={option.description}
                      onChange={(event) =>
                        onUpdateOption(dayIndex, optionIndex, {
                          description: event.target.value,
                        })
                      }
                      rows={3}
                      placeholder="Ej.: Pollo al jugo con arroz"
                      className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-base font-normal text-[var(--ink)]"
                    />
                  </label>
                </div>
              </article>
            );
          })}

          <button
            type="button"
            disabled={workerOptions.length >= MENU_ALTERNATIVES.length}
            onClick={() =>
              onUpdateDay(dayIndex, {
                options: [
                  ...day.options.filter((option) => option.availableForWorkers),
                  emptyOption(workerOptions.length, usedLabels),
                  ...day.options.filter((option) => !option.availableForWorkers),
                ],
              })
            }
            className="menu-action inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--brand)] px-4 text-base font-extrabold text-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            <Plus size={18} /> Agregar otra alternativa
          </button>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-white p-4 text-sm text-[var(--muted)]">
          Este día no aparecerá disponible para pedidos.
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onDone}
          className="menu-action inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 font-extrabold text-white"
        >
          <Check size={17} /> Listo
        </button>
      </div>
    </div>
  );
}

function toDraftDays(menu: MenuWeekDto): DraftDay[] {
  return menu.days.map((day) => ({
    serviceDate: day.serviceDate,
    disabled: day.disabled,
    options: day.options.map((option) => ({
      category: option.category,
      label: option.label,
      description: option.description,
      dessert: option.dessert,
      beverage: option.beverage,
      notes: option.notes,
      capacity: option.capacity,
      trainingMenu: option.trainingMenu,
      availableForWorkers: option.availableForWorkers,
      visible: option.visible,
      sortOrder: option.sortOrder,
    })),
  }));
}

function isDayComplete(day: DraftDay) {
  const visibleOptions = day.options.filter(
    (option) => option.visible && option.availableForWorkers,
  );
  return (
    visibleOptions.length > 0 &&
    visibleOptions.every(
      (option) =>
        option.label.trim().length >= 2 &&
        option.description.trim().length >= 3 &&
        option.capacity !== null,
    )
  );
}

function emptyOption(sortOrder: number, usedLabels = new Set<string>()): DraftOption {
  const alternative = MENU_ALTERNATIVES.find((item) => !usedLabels.has(item.label))
    ?? MENU_ALTERNATIVES[0];
  return {
    category: alternative.category,
    label: alternative.label,
    description: "",
    dessert: null,
    beverage: null,
    notes: null,
    capacity: null,
    trainingMenu: false,
    availableForWorkers: true,
    visible: true,
    sortOrder,
  };
}

function trainingOption(): DraftOption {
  return {
    category: "especial",
    label: "Menú capacitación",
    description: "",
    dessert: null,
    beverage: null,
    notes: null,
    capacity: null,
    trainingMenu: true,
    availableForWorkers: false,
    visible: true,
    sortOrder: 99,
  };
}

function createEmptyWeek(startsOn: string): DraftDay[] {
  return Array.from({ length: 7 }, (_, index) => ({
    serviceDate: addDays(startsOn, index),
    disabled: false,
    options: [emptyOption(0)],
  }));
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
