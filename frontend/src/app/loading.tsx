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
        <div className="relative grid size-40 place-items-center">
          <span
            className="absolute inset-0 rounded-full border border-[var(--line)] bg-[var(--brand-soft)] shadow-[0_18px_45px_rgba(190,85,42,0.18)] motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <span
            className="absolute inset-3 rounded-full bg-white/55"
            aria-hidden="true"
          />
          <BrandMark
            className="relative size-32 drop-shadow-[0_8px_12px_rgba(78,42,25,0.2)]"
            sizes="128px"
            priority
          />
        </div>
        <h1 className="mt-6 text-2xl font-black tracking-[-0.03em]">SN Colaciones</h1>
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
          Preparando tu experiencia…
        </p>
        <LoaderCircle
          size={26}
          className="mt-6 animate-spin text-[var(--brand)] motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span className="sr-only">Cargando el sistema</span>
      </section>
    </main>
  );
}
