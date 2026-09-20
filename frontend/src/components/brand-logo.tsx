import Image from "next/image";

export function BrandMark({ className = "size-11" }: { className?: string }) {
  return (
    <Image
      src="/brand/sandra-neira-mark.png"
      alt=""
      width={1254}
      height={1254}
      sizes="48px"
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
    <Image
      src="/brand/sandra-neira-vertical.png"
      alt="Sandra Neira, colaciones caseras"
      width={1254}
      height={1254}
      sizes="(max-width: 640px) 144px, 160px"
      priority={priority}
      className={`h-auto object-contain ${className}`}
    />
  );
}
