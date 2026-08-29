import { redirect } from "next/navigation";
import { requireApiRole } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function WorkerLayout({ children }: LayoutProps<"/pedidos">) {
  const user = await requireApiRole("worker");
  if (!user) redirect("/login?next=/pedidos");
  return children;
}
