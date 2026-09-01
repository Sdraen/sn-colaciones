import { redirect } from "next/navigation";
import { ProviderOperationsClient } from "@/components/provider-operations-client";
import type { DailySummaryDto, MenuWeekDto, NotificationDto, OrdersReportDto, ProviderOperationsDto } from "@/lib/api/contracts";
import { backendRequest, backendRequestOrNull, requireApiRole } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function ProviderAdminPage() {
  const user = await requireApiRole("provider_admin");
  if (!user) redirect("/login?next=/admin/proveedor");
  const today = chileDate(new Date()); const currentStartsOn = mondayOf(today); const nextStartsOn = addDays(currentStartsOn, 7);
  const [operations, nextMenu, report, notifications, summary] = await Promise.all([
    backendRequestOrNull<ProviderOperationsDto>(`/api/v1/provider/operations?startsOn=${currentStartsOn}`),
    backendRequestOrNull<MenuWeekDto>(`/api/v1/menus/current?startsOn=${nextStartsOn}`),
    backendRequest<OrdersReportDto>(`/api/v1/provider/reports?period=weekly&date=${today}`),
    backendRequest<NotificationDto[]>("/api/v1/notifications?limit=20"),
    backendRequestOrNull<DailySummaryDto>("/api/v1/summaries/daily", ["SERVICE_DAY_NOT_FOUND"]),
  ]);
  return <ProviderOperationsClient initialOperations={operations} initialNextMenu={nextMenu} nextStartsOn={nextStartsOn} initialReport={report} notifications={notifications} initialSummary={summary} />;
}

function chileDate(date: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
function mondayOf(value: string) { const date = new Date(`${value}T12:00:00Z`); const day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() - day + 1); return date.toISOString().slice(0,10); }
function addDays(value: string, amount: number) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0,10); }
