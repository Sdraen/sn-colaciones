import { redirect } from "next/navigation";
import { WorkerOrdersClient } from "@/components/worker-orders-client";
import { backendRequestOrNull, requireApiRole } from "@/lib/api/server";
import type { WorkerOrdersDto } from "@/lib/api/contracts";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await requireApiRole("worker");
  if (!user) redirect("/login?next=/pedidos");
  const data = await backendRequestOrNull<WorkerOrdersDto>("/api/v1/orders/me");

  if (!data) {
    return (
      <main className="page-shell">
        <section className="card mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-2xl font-black">Todavía no hay un menú publicado</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">La administradora proveedora debe publicar la próxima semana antes de que puedas reservar.</p>
        </section>
      </main>
    );
  }

  return <WorkerOrdersClient userName={user.fullName} initialData={data} nowIso={new Date().toISOString()} />;
}
