import { redirect } from "next/navigation";
import { requireApiRole } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function CompanyLayout({ children }: LayoutProps<"/admin/empresa">) {
  const user = await requireApiRole("company_admin");
  if (!user) redirect("/login?next=/admin/empresa");
  return children;
}
