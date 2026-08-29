import { redirect } from "next/navigation";
import { CompanyOperationsClient } from "@/components/company-operations-client";
import type { CompanyOperationsDto, MenuWeekDto, NotificationDto, OrdersReportDto } from "@/lib/api/contracts";
import { backendRequest, backendRequestOrNull, requireApiRole } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function CompanyAdminPage() {
  const user = await requireApiRole("company_admin");
  if (!user) redirect("/login?next=/admin/empresa");
  const [menu, operations, report, notifications] = await Promise.all([
    backendRequestOrNull<MenuWeekDto>("/api/v1/menus/current"),
    backendRequestOrNull<CompanyOperationsDto>("/api/v1/company/operations"),
    backendRequest<OrdersReportDto>("/api/v1/company/reports?period=weekly"),
    backendRequest<NotificationDto[]>("/api/v1/notifications?limit=20"),
  ]);
  return <CompanyOperationsClient menu={menu} initialOperations={operations} initialReport={report} notifications={notifications} nowIso={new Date().toISOString()} />;
}
