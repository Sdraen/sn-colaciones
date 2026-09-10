import { redirect } from "next/navigation";
import { WorkerOrdersClient } from "@/components/worker-orders-client";
import { WorkerWeekSelector } from "@/components/worker-week-selector";
import { backendRequest, backendRequestOrNull, requireApiRole } from "@/lib/api/server";
import type {
  WorkerMenuWeekSummaryDto,
  WorkerOrdersDto,
} from "@/lib/api/contracts";
import { formatChileanDate } from "@/lib/date-format";

export const dynamic = "force-dynamic";

interface OrdersPageProps {
  searchParams: Promise<{ week?: string | string[] }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const user = await requireApiRole("worker");
  if (!user) redirect("/login?next=/pedidos");
  const currentWeekStartsOn = mondayOf(chileDate(new Date()));
  const requestedWeekValue = (await searchParams).week;
  const requestedWeek = Array.isArray(requestedWeekValue)
    ? requestedWeekValue[0]
    : requestedWeekValue;
  const requestedCandidate = isCurrentOrFutureIsoDate(
    requestedWeek,
    currentWeekStartsOn,
  )
    ? requestedWeek
    : currentWeekStartsOn;
  const [publishedWeeks, requestedData] = await Promise.all([
    backendRequest<WorkerMenuWeekSummaryDto[]>("/api/v1/orders/me/weeks"),
    backendRequestOrNull<WorkerOrdersDto>(
      `/api/v1/orders/me?startsOn=${requestedCandidate}`,
    ),
  ]);
  const selectedStartsOn = selectAvailableWeek(
    requestedCandidate,
    currentWeekStartsOn,
    publishedWeeks,
  );
  const selectedIsPublished = publishedWeeks.some(
    (week) => week.startsOn === selectedStartsOn,
  );
  const data =
    selectedStartsOn === requestedCandidate
      ? requestedData
      : selectedIsPublished
        ? await backendRequestOrNull<WorkerOrdersDto>(
            `/api/v1/orders/me?startsOn=${selectedStartsOn}`,
          )
        : null;

  if (!data) {
    return (
      <main className="page-shell">
        <header>
          <p className="eyebrow">Solicitud semanal</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Elige tus almuerzos</h1>
        </header>
        <div className="mt-7">
          <WorkerWeekSelector
            currentStartsOn={currentWeekStartsOn}
            selectedStartsOn={currentWeekStartsOn}
            publishedWeeks={publishedWeeks}
          />
        </div>
        <section className="card mt-5 p-8 text-center">
          <h2 className="text-2xl font-black">Aún no hay un menú para esta semana</h2>
          <p className="mt-3 text-sm text-[var(--muted)]">
            La semana actual comenzó el {formatChileanDate(currentWeekStartsOn)}.
            La proveedora todavía no publica sus colaciones.
          </p>
        </section>
      </main>
    );
  }

  return (
    <WorkerOrdersClient
      userName={user.fullName}
      initialData={data}
      nowIso={new Date().toISOString()}
      currentStartsOn={currentWeekStartsOn}
      publishedWeeks={publishedWeeks}
    />
  );
}

function selectAvailableWeek(
  requestedWeek: string | undefined,
  currentStartsOn: string,
  publishedWeeks: WorkerMenuWeekSummaryDto[],
) {
  if (
    requestedWeek &&
    requestedWeek >= currentStartsOn &&
    publishedWeeks.some((week) => week.startsOn === requestedWeek)
  ) {
    return requestedWeek;
  }
  return currentStartsOn;
}

function isCurrentOrFutureIsoDate(
  value: string | undefined,
  currentStartsOn: string,
): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < currentStartsOn) {
    return false;
  }
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function chileDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function mondayOf(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date.toISOString().slice(0, 10);
}
