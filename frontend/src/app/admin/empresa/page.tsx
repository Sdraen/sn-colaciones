import { redirect } from "next/navigation";
import { CompanyOperationsClient } from "@/components/company-operations-client";
import type { CompanyOperationsDto, DailySummaryDto, MenuWeekDto, NotificationDto, OrdersReportDto, WorkerAccountDto } from "@/lib/api/contracts";
import { backendRequest, backendRequestOrNull, requireApiRole } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function CompanyAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  const user = await requireApiRole("company_admin");
  if (!user) redirect("/login?next=/admin/empresa");
  const [menu, operations, report, notifications, summary, workers] = await Promise.all([
    backendRequestOrNull<MenuWeekDto>("/api/v1/menus/current"),
    backendRequestOrNull<CompanyOperationsDto>("/api/v1/company/operations"),
    backendRequest<OrdersReportDto>("/api/v1/company/reports?period=weekly"),
    backendRequest<NotificationDto[]>("/api/v1/notifications?limit=20"),
    backendRequestOrNull<DailySummaryDto>("/api/v1/summaries/daily", ["SERVICE_DAY_NOT_FOUND"]),
    backendRequest<WorkerAccountDto[]>("/api/v1/company/workers"),
  ]);
  return <CompanyOperationsClient menu={menu} initialOperations={operations} initialReport={report} notifications={notifications} nowIso={new Date().toISOString()} initialSummary={summary} initialWorkers={workers} initialView={section === "workers" ? "workers" : undefined} />;
}
