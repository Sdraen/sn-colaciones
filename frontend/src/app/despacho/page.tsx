import { DailySummary } from "@/components/daily-summary";
import type { DailySummaryDto } from "@/lib/api/contracts";
import { backendRequestOrNull } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  const summary = await backendRequestOrNull<DailySummaryDto>("/api/v1/summaries/daily", ["SERVICE_DAY_NOT_FOUND"]);
  return <main className="page-shell provider-shell-enter"><header className="mb-7"><p className="eyebrow">Panel de despacho</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Carga y entrega del día</h1><p className="mt-2 text-[var(--muted)]">Consulta el resumen siempre disponible. Los datos se actualizan hasta el cierre de las 13:00.</p></header><DailySummary initialSummary={summary} /></main>;
}
