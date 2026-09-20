import { LoaderCircle } from "lucide-react";
import { BrandMark } from "@/components/brand-logo";

export default function Loading() {
  return (
    <main
      className="page-shell grid min-h-[calc(100dvh-72px)] place-items-center"
      aria-busy="true"
    >
      <section
        role="status"
        aria-live="polite"
        className="flex flex-col items-center px-6 py-12 text-center"
      >
        <div className="relative">
          <span
            className="absolute -inset-3 rounded-full bg-[var(--brand-soft)] opacity-70 motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <BrandMark className="relative size-24 drop-shadow-md" />
        </div>
        <h1 className="mt-5 text-xl font-black tracking-[-0.03em]">SN Colaciones</h1>
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
          Preparando tu experiencia…
        </p>
        <LoaderCircle
          size={22}
          className="mt-5 animate-spin text-[var(--brand)] motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span className="sr-only">Cargando el sistema</span>
      </section>
    </main>
  );
}
