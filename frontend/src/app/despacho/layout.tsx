import { redirect } from "next/navigation";
import { requireApiRole } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function DeliveryLayout({ children }: LayoutProps<"/despacho">) {
  const user = await requireApiRole("delivery");
  if (!user) redirect("/login?next=/despacho");
  return children;
}
