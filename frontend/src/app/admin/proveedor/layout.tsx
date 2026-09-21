import { redirect } from "next/navigation";
import { requireApiRole } from "@/lib/api/server";
import { mfaPath } from "@/lib/auth-flow";

export const dynamic = "force-dynamic";

export default async function ProviderLayout({ children }: LayoutProps<"/admin/proveedor">) {
  const user = await requireApiRole("provider_admin");
  if (!user) redirect("/login?next=/admin/proveedor");
  if (user.assuranceLevel !== "aal2") redirect(mfaPath("/admin/proveedor"));
  return children;
}
