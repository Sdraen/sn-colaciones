"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

export default function OrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[pedidos] No fue posible mostrar la semana seleccionada", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="page-shell">
      <section className="card mx-auto max-w-xl p-6 text-center sm:p-8">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-50 text-[var(--danger)]">
          <TriangleAlert size={24} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-black">No pudimos abrir esta semana</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Revisa tu conexión y vuelve a intentarlo. Tus reservas no fueron modificadas.
        </p>
        <button
          type="button"
          onClick={reset}
          className="focus-ring mx-auto mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 font-extrabold text-white"
        >
          <RefreshCw size={17} aria-hidden="true" /> Reintentar
        </button>
      </section>
    </main>
  );
}
