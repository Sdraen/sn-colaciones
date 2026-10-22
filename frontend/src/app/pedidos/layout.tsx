import { redirect } from "next/navigation";
import { requireApiRoles } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function WorkerLayout({ children }: LayoutProps<"/pedidos">) {
  const user = await requireApiRoles("worker", "external_worker");
  if (!user) redirect("/login?next=/pedidos");
  return children;
}
