"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChefHat, ClipboardCheck, Home } from "lucide-react";

const links = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/pedidos", label: "Mi pedido", icon: ClipboardCheck },
  { href: "/admin/empresa", label: "Securitas", icon: Building2 },
  { href: "/admin/proveedor", label: "Proveedor", icon: ChefHat },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[#fffdf8]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-18 w-[min(1180px,calc(100%_-_32px))] items-center justify-between gap-6">
        <Link href="/" className="focus-ring flex items-center gap-3 rounded-xl">
          <span className="grid size-10 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--brand),var(--accent))] text-white shadow-lg shadow-orange-950/15">
            <ChefHat size={21} strokeWidth={2.2} />
          </span>
          <span>
            <span className="block text-sm font-extrabold tracking-[-0.02em]">
              SN Colaciones
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              Cocina casera · Demo
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`focus-ring flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>
        </div>
      </header>

      <nav
        className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-2xl border border-[var(--line)] bg-[#fffdf8]/96 p-1.5 shadow-2xl backdrop-blur-xl md:hidden"
        aria-label="Navegación móvil"
      >
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${
                active
                  ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                  : "text-[var(--muted)]"
              }`}
            >
              <Icon size={19} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
