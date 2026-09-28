"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, LoaderCircle } from "lucide-react";
import { FormSelect } from "@/components/ui/form-select";
import type { WorkerMenuWeekSummaryDto } from "@/lib/api/contracts";
import { formatChileanDate } from "@/lib/date-format";

interface WorkerWeekSelectorProps {
  currentStartsOn: string;
  selectedStartsOn: string;
  publishedWeeks: WorkerMenuWeekSummaryDto[];
}

export function WorkerWeekSelector({
  currentStartsOn,
  selectedStartsOn,
  publishedWeeks,
}: WorkerWeekSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const currentIsPublished = publishedWeeks.some(
    (week) => week.startsOn === currentStartsOn,
  );
  const futureWeeks = publishedWeeks.filter(
    (week) => week.startsOn > currentStartsOn,
  );

  function selectWeek(startsOn: string) {
    startTransition(() => {
      router.push(
        startsOn === currentStartsOn
          ? "/pedidos"
          : `/pedidos?week=${encodeURIComponent(startsOn)}`,
      );
    });
  }

  return (
    <>
      <section
        aria-busy={isPending}
        className="rounded-2xl border border-[var(--line)] bg-white/80 p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-5"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
            <CalendarDays size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-extrabold">Semana de tus colaciones</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Las próximas aparecen cuando la proveedora publica el menú.
            </p>
          </div>
        </div>

        <label className="mt-4 block min-w-64 text-xs font-bold text-[var(--muted)] sm:mt-0">
          Seleccionar semana
          <FormSelect
            value={selectedStartsOn}
            disabled={isPending}
            onValueChange={selectWeek}
            ariaLabel="Seleccionar semana"
            options={[
              {
                value: currentStartsOn,
                label: `Semana actual · ${formatChileanDate(currentStartsOn)}${
                  currentIsPublished ? "" : " · Sin menú"
                }`,
              },
              ...futureWeeks.map((week) => ({
                value: week.startsOn,
                label: `Semana del ${formatChileanDate(week.startsOn)}`,
              })),
            ]}
            className="mt-2 min-h-11 text-sm font-bold"
          />
        </label>
      </section>
      {isPending ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 grid place-items-center bg-[var(--cream)]/85 px-5 backdrop-blur-sm"
        >
          <div className="card flex min-w-56 flex-col items-center p-7 text-center shadow-xl">
            <LoaderCircle
              size={34}
              className="animate-spin text-[var(--brand)] motion-reduce:animate-none"
              aria-hidden="true"
            />
            <p className="mt-4 font-extrabold">Cargando semana…</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Preparando menú y reservas.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
