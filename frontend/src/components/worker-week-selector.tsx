"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
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
    <section className="rounded-2xl border border-[var(--line)] bg-white/80 p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-5">
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
        <select
          value={selectedStartsOn}
          disabled={isPending}
          onChange={(event) => selectWeek(event.target.value)}
          className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-bold text-[var(--ink)] disabled:cursor-wait disabled:opacity-60"
        >
          <option value={currentStartsOn}>
            Semana actual · {formatChileanDate(currentStartsOn)}
            {currentIsPublished ? "" : " · Sin menú"}
          </option>
          {futureWeeks.map((week) => (
            <option key={week.id} value={week.startsOn}>
              Semana del {formatChileanDate(week.startsOn)}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
