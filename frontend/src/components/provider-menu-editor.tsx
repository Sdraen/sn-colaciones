"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { browserApiRequest } from "@/lib/api/client";
import type { MenuWeekDto } from "@/lib/api/contracts";
import { formatChileanDate, formatChileanDateWithWeekday } from "@/lib/date-format";

type DraftOption = {
  category: string;
  label: string;
  description: string;
  capacity: number | null;
  trainingMenu: boolean;
  visible: boolean;
  sortOrder: number;
};

type DraftDay = {
  serviceDate: string;
  disabled: boolean;
  options: DraftOption[];
};

type Feedback = { kind: "success" | "error"; text: string } | null;

export function ProviderMenuEditor({
  initialMenu,
  startsOn,
}: {
  initialMenu: MenuWeekDto | null;
  startsOn: string;
}) {
  const [menu, setMenu] = useState(initialMenu);
  const [days, setDays] = useState<DraftDay[]>(() =>
    initialMenu ? toDraftDays(initialMenu) : createEmptyWeek(startsOn),
  );
  const [editingDay, setEditingDay] = useState<number | null>(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const weekdays = days.slice(0, 5);
  const readyDays = weekdays.filter((day) => day.disabled || isDayComplete(day)).length;
  const weekComplete = readyDays === weekdays.length;
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

  function setTrainingMenu(dayIndex: number, optionIndex: number) {
    setDays((current) =>
      current.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              options: day.options.map((option, currentIndex) => ({
                ...option,
                trainingMenu: currentIndex === optionIndex,
              })),
            }
          : day,
      ),
    );
    setDirty(true);
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
    <section className="menu-editor-enter mt-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Semana del {formatChileanDate(startsOn)}</p>
          <h2 className="mt-1 text-2xl font-black">Menú de la próxima semana</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {published
              ? "Esta semana ya está publicada y quedó protegida contra cambios."
              : `${readyDays} de 5 días preparados. Completa cada día y luego publica.`}
          </p>
        </div>
        {!menu && !published ? (
          <button
            type="button"
            onClick={copyPreviousWeek}
            disabled={saving}
            className="menu-action inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-extrabold text-[var(--ink)] shadow-sm hover:bg-[var(--surface-muted)] disabled:opacity-50"
          >
            <Copy size={17} /> Copiar semana anterior
          </button>
        ) : null}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]" aria-hidden="true">
        <div
          className="menu-progress-fill h-full rounded-full bg-[var(--herb)]"
          style={{ width: `${readyDays * 20}%` }}
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

      <div className="menu-week-list card divide-y divide-[var(--line)] overflow-hidden">
        {weekdays.map((day, dayIndex) => {
          const complete = day.disabled || isDayComplete(day);
          const expanded = editingDay === dayIndex && !published;
          const description = day.disabled
            ? "Sin servicio"
            : day.options.find((option) => option.visible)?.description.trim() ||
              "Preparación pendiente";

          return (
            <div key={day.serviceDate}>
              <button
                type="button"
                onClick={() => {
                  setEditingDay(expanded ? null : dayIndex);
                  setAdvancedOpen(false);
                }}
                aria-expanded={expanded}
                disabled={published}
                className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 text-left transition-colors duration-200 hover:bg-[var(--surface-muted)] disabled:cursor-default disabled:hover:bg-white sm:px-5"
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
                  <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-soft)] px-3 py-2 text-sm font-extrabold text-[var(--brand)] transition-transform duration-200 group-hover:translate-x-0.5">
                    <Pencil size={15} /> {complete ? "Editar" : "Agregar"}
                  </span>
                ) : null}
              </button>

              <div
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
                    advancedOpen={advancedOpen}
                    onToggleAdvanced={() => setAdvancedOpen((current) => !current)}
                    onUpdateDay={updateDay}
                    onUpdateOption={updateOption}
                    onSetTrainingMenu={setTrainingMenu}
                    onDone={() => setEditingDay(null)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!published ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {menu && !confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
                className="menu-action inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-extrabold text-[var(--danger)] hover:bg-red-100 disabled:opacity-50"
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
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={saveDraft}
              disabled={saving || !dirty}
              className="menu-action inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 font-extrabold text-white hover:brightness-95 disabled:opacity-40"
            >
              <Save size={18} /> Guardar borrador
            </button>
            <button
              type="button"
              onClick={publishWeek}
              disabled={saving || !weekComplete}
              className="menu-action inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--herb)] px-5 font-extrabold text-white hover:brightness-95 disabled:opacity-40"
            >
              <Send size={18} /> {dirty || !menu ? "Guardar y publicar" : "Publicar semana"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DayEditor({
  day,
  dayIndex,
  advancedOpen,
  onToggleAdvanced,
  onUpdateDay,
  onUpdateOption,
  onSetTrainingMenu,
  onDone,
}: {
  day: DraftDay;
  dayIndex: number;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  onUpdateDay: (index: number, patch: Partial<DraftDay>) => void;
  onUpdateOption: (dayIndex: number, optionIndex: number, patch: Partial<DraftOption>) => void;
  onSetTrainingMenu: (dayIndex: number, optionIndex: number) => void;
  onDone: () => void;
}) {
  const primary = day.options[0] ?? emptyOption(0);

  return (
    <div className="border-t border-[var(--line)] bg-[var(--cream)] px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black">Preparación del día</p>
          <p className="text-xs text-[var(--muted)]">Escribe el plato tal como lo verá el trabajador.</p>
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
        <>
          <label className="mt-4 block text-sm font-extrabold" htmlFor={`preparation-${dayIndex}`}>
            Preparación principal
          </label>
          <textarea
            id={`preparation-${dayIndex}`}
            value={primary.description}
            onChange={(event) => {
              if (day.options.length === 0) {
                onUpdateDay(dayIndex, {
                  options: [{ ...primary, description: event.target.value }],
                });
              } else {
                onUpdateOption(dayIndex, 0, { description: event.target.value });
              }
            }}
            placeholder="Ej.: Pollo al jugo con arroz y ensalada"
            rows={3}
            className="mt-2 w-full resize-y rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none transition duration-200 focus:-translate-y-px focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
          />

          <button
            type="button"
            onClick={onToggleAdvanced}
            className="menu-action mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-[var(--brand)]"
          >
            {advancedOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            Opciones avanzadas
          </button>

          <div
            className={`menu-collapsible grid ${
              advancedOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
            aria-hidden={!advancedOpen}
            inert={!advancedOpen}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="mt-3 space-y-3 rounded-xl border border-[var(--line)] bg-white p-4">
              {day.options.map((option, optionIndex) => (
                <div
                  key={`${day.serviceDate}-${optionIndex}`}
                  className="grid gap-3 border-b border-[var(--line)] pb-4 last:border-0 last:pb-0 lg:grid-cols-2"
                >
                  <label className="text-xs font-extrabold text-[var(--muted)]">
                    Nombre visible
                    <input
                      value={option.label}
                      onChange={(event) =>
                        onUpdateOption(dayIndex, optionIndex, { label: event.target.value })
                      }
                      className="mt-1 min-h-10 w-full rounded-lg border border-[var(--line)] px-3 text-sm text-[var(--ink)]"
                    />
                  </label>
                  <label className="text-xs font-extrabold text-[var(--muted)]">
                    Categoría
                    <select
                      value={option.category}
                      onChange={(event) =>
                        onUpdateOption(dayIndex, optionIndex, { category: event.target.value })
                      }
                      className="mt-1 min-h-10 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)]"
                    >
                      <option value="principal">Principal</option>
                      <option value="vegetariano">Vegetariano</option>
                      <option value="hipocalorico">Hipocalórico</option>
                      <option value="sandwich">Sándwich</option>
                      <option value="handroll">Handroll</option>
                      <option value="especial">Especial</option>
                    </select>
                  </label>
                  {optionIndex > 0 ? (
                    <label className="text-xs font-extrabold text-[var(--muted)] lg:col-span-2">
                      Preparación
                      <textarea
                        value={option.description}
                        onChange={(event) =>
                          onUpdateOption(dayIndex, optionIndex, {
                            description: event.target.value,
                          })
                        }
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)]"
                      />
                    </label>
                  ) : null}
                  <label className="text-xs font-extrabold text-[var(--muted)]">
                    Disponibilidad máxima (opcional)
                    <input
                      type="number"
                      min="0"
                      value={option.capacity ?? ""}
                      onChange={(event) =>
                        onUpdateOption(dayIndex, optionIndex, {
                          capacity: event.target.value === "" ? null : Number(event.target.value),
                        })
                      }
                      placeholder="Sin límite"
                      className="mt-1 min-h-10 w-full rounded-lg border border-[var(--line)] px-3 text-sm text-[var(--ink)]"
                    />
                  </label>
                  <div className="flex flex-wrap items-end gap-4 pb-2 text-xs font-extrabold">
                    <label>
                      <input
                        type="radio"
                        name={`training-${dayIndex}`}
                        checked={option.trainingMenu}
                        onChange={() => onSetTrainingMenu(dayIndex, optionIndex)}
                        className="mr-2 accent-[var(--herb)]"
                      />
                      Menú capacitación
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={option.visible}
                        onChange={(event) =>
                          onUpdateOption(dayIndex, optionIndex, { visible: event.target.checked })
                        }
                        className="mr-2 accent-[var(--herb)]"
                      />
                      Visible
                    </label>
                    {day.options.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateDay(dayIndex, {
                            options: day.options
                              .filter((_, index) => index !== optionIndex)
                              .map((item, index) => ({ ...item, sortOrder: index })),
                          })
                        }
                        className="menu-action inline-flex items-center gap-1 text-[var(--danger)]"
                      >
                        <X size={15} /> Eliminar alternativa
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  onUpdateDay(dayIndex, {
                    options: [...day.options, emptyOption(day.options.length)],
                  })
                }
                className="menu-action inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--brand)] px-3 text-sm font-extrabold text-[var(--brand)]"
              >
                <Plus size={16} /> Agregar alternativa
              </button>
              </div>
            </div>
          </div>
        </>
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
      capacity: option.capacity,
      trainingMenu: option.trainingMenu,
      visible: option.visible,
      sortOrder: option.sortOrder,
    })),
  }));
}

function isDayComplete(day: DraftDay) {
  const visibleOptions = day.options.filter((option) => option.visible);
  return (
    visibleOptions.length > 0 &&
    visibleOptions.every(
      (option) =>
        option.label.trim().length >= 2 && option.description.trim().length >= 3,
    )
  );
}

function emptyOption(sortOrder: number): DraftOption {
  return {
    category: "principal",
    label: sortOrder === 0 ? "Menú principal" : `Alternativa ${sortOrder + 1}`,
    description: "",
    capacity: null,
    trainingMenu: sortOrder === 0,
    visible: true,
    sortOrder,
  };
}

function createEmptyWeek(startsOn: string): DraftDay[] {
  return Array.from({ length: 7 }, (_, index) => ({
    serviceDate: addDays(startsOn, index),
    disabled: index >= 5,
    options: index >= 5 ? [] : [emptyOption(0)],
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
