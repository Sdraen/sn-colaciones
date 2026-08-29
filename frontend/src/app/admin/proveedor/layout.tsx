import { redirect } from "next/navigation";
import { requireApiRole } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function ProviderLayout({ children }: LayoutProps<"/admin/proveedor">) {
  const user = await requireApiRole("provider_admin");
  if (!user) redirect("/login?next=/admin/proveedor");
  return children;
}
