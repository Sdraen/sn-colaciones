import { LoaderCircle } from "lucide-react";

export default function OrdersLoading() {
  return (
    <main
      className="page-shell grid min-h-[calc(100dvh-72px)] place-items-center"
      aria-busy="true"
    >
      <section
        role="status"
        aria-live="polite"
        className="card flex min-w-60 flex-col items-center p-8 text-center"
      >
        <LoaderCircle
          size={36}
          className="animate-spin text-[var(--brand)] motion-reduce:animate-none"
          aria-hidden="true"
        />
        <h1 className="mt-4 text-lg font-black">Cargando semana…</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Preparando menú y reservas.
        </p>
      </section>
    </main>
  );
}
