import Image from "next/image";

const brandMarkSource = "/brand/sn-colaciones-vintage-mark.png";

export function BrandMark({
  className = "size-11",
  sizes = "48px",
  priority = false,
}: {
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={brandMarkSource}
      alt=""
      width={1254}
      height={1254}
      sizes={sizes}
      quality={100}
      priority={priority}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

export function BrandVertical({
  className = "w-40",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center text-center ${className}`}
      role="img"
      aria-label="SN Colaciones, cocina casera y gestión diaria"
    >
      <Image
        src={brandMarkSource}
        alt=""
        width={1254}
        height={1254}
        sizes="(max-width: 640px) 144px, 160px"
        quality={100}
        priority={priority}
        className="h-auto w-full object-contain"
      />
      <span
        aria-hidden="true"
        className="brand-wordmark -mt-1 block text-[1.15rem] font-black leading-none tracking-[-0.035em] text-[var(--foreground)]"
      >
        SN Colaciones
      </span>
      <span
        aria-hidden="true"
        className="mt-1.5 block whitespace-nowrap text-[0.4rem] font-extrabold uppercase leading-none tracking-[0.12em] text-[var(--muted)]"
      >
        Cocina casera · Gestión diaria
      </span>
    </div>
  );
}
