"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { ChevronDown, Plus, Save, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SuccessDialog } from "@/components/ui/success-dialog";
import { browserApiRequest } from "@/lib/api/client";
import type { MenuWeekDto } from "@/lib/api/contracts";
import { formatChileanDateWithWeekday } from "@/lib/date-format";

type TrainingPreparation = {
  id?: string;
  label: string;
  description: string;
  capacity: number | null;
  reservedQuantity: number;
};

type TrainingDay = MenuWeekDto["days"][number];

const EMPTY_PREPARATIONS: TrainingPreparation[] = [];

function initialPreparations(menu: MenuWeekDto) {
  return Object.fromEntries(menu.days.map((day) => [
    day.id,
    day.options.filter((option) => option.trainingMenu && option.visible).map((option) => ({
      id: option.id,
      label: option.label,
      description: option.description,
      capacity: option.capacity,
      reservedQuantity: option.reservedQuantity,
    })),
  ])) as Record<string, TrainingPreparation[]>;
}

export function ProviderDailyTrainingEditor({
  menu,
  onMenuChange,
}: {
  menu: MenuWeekDto;
  onMenuChange: (menu: MenuWeekDto) => void;
}) {
  const [drafts, setDrafts] = useState(() => initialPreparations(menu));
  const [weekExpanded, setWeekExpanded] = useState(true);
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
  const [savingDayId, setSavingDayId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const workingDays = useMemo(() => menu.days.filter((day) => {
    if (day.disabled) return false;
    const weekday = new Date(`${day.serviceDate}T12:00:00Z`).getUTCDay();
    return weekday >= 1 && weekday <= 5;
  }), [menu.days]);

  const changeDay = useCallback((dayId: string, preparations: TrainingPreparation[]) => {
    setDrafts((current) => ({ ...current, [dayId]: preparations }));
    setError("");
  }, []);

  const save = useCallback(async (
    dayId: string,
    preparations: TrainingPreparation[],
    confirmImpact: boolean,
  ) => {
    if (preparations.some((option) =>
      option.label.trim().length < 2 ||
      option.description.trim().length < 3 ||
      option.capacity === null ||
      option.capacity < option.reservedQuantity
    )) {
      setError("Completa nombre, preparación y cupo. El cupo no puede ser menor que lo reservado.");
      return;
    }
    setSavingDayId(dayId);
    setError("");
    try {
      const saved = await browserApiRequest<MenuWeekDto>(
        `/api/v1/provider/service-days/${dayId}/training-menus`,
        {
          method: "PUT",
          body: JSON.stringify({
            options: preparations.map(({ id, label, description, capacity }) => ({
              ...(id ? { id } : {}), label, description, capacity,
            })),
            confirmImpact,
          }),
        },
      );
      setDrafts((current) => ({
        ...current,
        [dayId]: initialPreparations(saved)[dayId] ?? [],
      }));
      onMenuChange(saved);
      setSuccess("Preparaciones de capacitación guardadas para el día.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible guardar");
    } finally {
      setSavingDayId(null);
    }
  }, [onMenuChange]);

  const toggleWeek = useCallback(() => {
    setWeekExpanded((current) => !current);
    setExpandedDayId(null);
  }, []);

  const toggleDay = useCallback((dayId: string) => {
    setExpandedDayId((current) => current === dayId ? null : dayId);
  }, []);

  return (
    <section className="provider-card-motion card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Apartado independiente</p>
          <h3 className="mt-1 text-xl font-black">Menú de capacitaciones por día</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Agrega hasta 10 preparaciones por día hábil. Cada una tiene cupo propio.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleWeek}
          aria-expanded={weekExpanded}
          aria-controls="training-week-days"
          className="menu-action inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--herb-soft)] px-4 text-sm font-extrabold text-[var(--herb-strong)] sm:w-auto"
        >
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={`menu-day-chevron transition-transform duration-300 ${weekExpanded ? "rotate-180" : ""}`}
          />
          {weekExpanded ? "Cerrar semana" : "Abrir semana"}
        </button>
      </div>
      <SuccessDialog message={success || null} onClose={() => setSuccess("")} />
      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div
        id="training-week-days"
        className={`menu-collapsible grid ${
          weekExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
        aria-hidden={!weekExpanded}
        inert={!weekExpanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-5 space-y-3">
            {workingDays.map((day) => (
              <MemoizedTrainingDayEditor
                key={day.id}
                day={day}
                preparations={drafts[day.id] ?? EMPTY_PREPARATIONS}
                expanded={expandedDayId === day.id}
                saveInProgress={savingDayId !== null}
                onToggle={toggleDay}
                onChange={changeDay}
                onSave={save}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrainingDayEditor({
  day,
  preparations,
  expanded,
  saveInProgress,
  onToggle,
  onChange,
  onSave,
}: {
  day: TrainingDay;
  preparations: TrainingPreparation[];
  expanded: boolean;
  saveInProgress: boolean;
  onToggle: (dayId: string) => void;
  onChange: (dayId: string, preparations: TrainingPreparation[]) => void;
  onSave: (
    dayId: string,
    preparations: TrainingPreparation[],
    confirmImpact: boolean,
  ) => Promise<void>;
}) {
  const { changed, impact } = useMemo(() => {
    const original = day.options.filter((option) => option.trainingMenu && option.visible);
    const hasImpact = preparations.some((option) => {
      const saved = original.find((item) => item.id === option.id);
      return Boolean(saved && saved.reservedQuantity > 0 && (
        saved.label !== option.label || saved.description !== option.description
      ));
    });
    const hasChanges = preparations.length !== original.length || preparations.some((item, index) => {
      const option = original[index];
      return !option ||
        item.id !== option.id ||
        item.label !== option.label ||
        item.description !== option.description ||
        item.capacity !== option.capacity;
    });
    return { changed: hasChanges, impact: hasImpact };
  }, [day.options, preparations]);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)]">
      <button
        type="button"
        onClick={() => onToggle(day.id)}
        aria-expanded={expanded}
        aria-controls={`training-day-${day.id}`}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left font-extrabold"
      >
        <span>
          {formatChileanDateWithWeekday(day.serviceDate)} · {preparations.length}{" "}
          {preparations.length === 1 ? "preparación" : "preparaciones"}
        </span>
        <ChevronDown
          size={19}
          aria-hidden="true"
          className={`menu-day-chevron transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      <div
        id={`training-day-${day.id}`}
        className={`menu-collapsible grid ${
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-4 border-t border-[var(--line)] bg-[var(--cream)] p-4">
            {preparations.map((option, index) => (
              <div
                key={option.id ?? `new-${index}`}
                className="rounded-xl border border-[var(--line)] bg-white p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black">Preparación {index + 1}</p>
                  <button
                    type="button"
                    disabled={option.reservedQuantity > 0 || saveInProgress}
                    onClick={() => onChange(
                      day.id,
                      preparations.filter((_, itemIndex) => itemIndex !== index),
                    )}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-50 px-3 text-sm font-bold text-[var(--danger)] disabled:opacity-40"
                  >
                    <Trash2 size={16} /> Quitar
                  </button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-extrabold">
                    Nombre
                    <input
                      value={option.label}
                      maxLength={80}
                      onChange={(event) => onChange(
                        day.id,
                        preparations.map((item, itemIndex) => itemIndex === index
                          ? { ...item, label: event.target.value }
                          : item),
                      )}
                      className="form-control mt-2 px-4"
                      placeholder="Ej.: Hipocalórico"
                    />
                  </label>
                  <label className="text-sm font-extrabold">
                    Cupo del día
                    <input
                      type="number"
                      min={option.reservedQuantity}
                      max="10000"
                      value={option.capacity ?? ""}
                      onChange={(event) => onChange(
                        day.id,
                        preparations.map((item, itemIndex) => itemIndex === index
                          ? {
                              ...item,
                              capacity: event.target.value === "" ? null : Number(event.target.value),
                            }
                          : item),
                      )}
                      className="form-control mt-2 px-4"
                    />
                  </label>
                  <label className="text-sm font-extrabold sm:col-span-2">
                    Plato o preparación
                    <textarea
                      value={option.description}
                      maxLength={300}
                      rows={2}
                      onChange={(event) => onChange(
                        day.id,
                        preparations.map((item, itemIndex) => itemIndex === index
                          ? { ...item, description: event.target.value }
                          : item),
                      )}
                      className="form-control mt-2 p-4"
                      placeholder="Ej.: Pollo con verduras"
                    />
                  </label>
                </div>
                {option.reservedQuantity > 0 ? (
                  <p className="mt-2 text-xs font-bold text-[var(--herb-strong)]">
                    {option.reservedQuantity} reservadas
                  </p>
                ) : null}
              </div>
            ))}
            <div className="flex flex-wrap gap-2 sm:justify-between">
              <button
                type="button"
                disabled={preparations.length >= 10 || saveInProgress}
                onClick={() => onChange(day.id, [
                  ...preparations,
                  {
                    label: `Menú capacitación ${preparations.length + 1}`,
                    description: "",
                    capacity: null,
                    reservedQuantity: 0,
                  },
                ])}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--brand)] px-4 font-bold text-[var(--brand)] disabled:opacity-40"
              >
                <Plus size={17} /> Otra preparación
              </button>
              {impact ? (
                <ConfirmDialog
                  title="¿Cambiar preparación reservada?"
                  description="Los cupos se mantienen. Revisa que Securitas conozca la nueva preparación."
                  confirmLabel="Sí, guardar"
                  onConfirm={() => onSave(day.id, preparations, true)}
                  trigger={(
                    <button
                      type="button"
                      disabled={!changed || saveInProgress}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 font-bold text-white disabled:opacity-40"
                    >
                      <Save size={17} /> Guardar día
                    </button>
                  )}
                />
              ) : (
                <button
                  type="button"
                  disabled={!changed || saveInProgress}
                  onClick={() => void onSave(day.id, preparations, false)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-4 font-bold text-white disabled:opacity-40"
                >
                  <Save size={17} /> Guardar día
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const MemoizedTrainingDayEditor = memo(TrainingDayEditor);
