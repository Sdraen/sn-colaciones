"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChefHat,
  ClipboardCheck,
  Home,
  LogIn,
  LogOut,
  Truck,
} from "lucide-react";
import type { CurrentUser } from "@/lib/api/types";

export function SiteHeader({
  currentUser,
}: {
  currentUser: CurrentUser | null;
}) {
  const pathname = usePathname();
  const links = navigationFor(currentUser);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[#fffdf8]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-18 w-[min(1180px,calc(100%_-_32px))] items-center justify-between gap-6">
          <Link href="/" className="focus-ring flex items-center gap-3 rounded-xl">
            <span className="grid size-10 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--brand),var(--accent))] text-white shadow-lg shadow-orange-950/15">
              <ChefHat size={21} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-extrabold tracking-[-0.02em]">
                SN Colaciones
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Cocina casera · Gestión diaria
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
                  <Icon size={17} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
            {currentUser ? (
              <form action="/auth/signout" method="post" className="ml-2 border-l border-[var(--line)] pl-3">
                <button
                  type="submit"
                  className="focus-ring flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                  title={`Cerrar sesión de ${currentUser.fullName}`}
                >
                  <span className="max-w-36 truncate">{currentUser.fullName}</span>
                  <LogOut size={16} aria-hidden="true" />
                </button>
              </form>
            ) : null}
          </nav>
        </div>
      </header>

      <nav
        className="fixed inset-x-3 bottom-3 z-50 flex justify-around rounded-2xl border border-[var(--line)] bg-[#fffdf8]/96 p-1.5 shadow-2xl backdrop-blur-xl md:hidden"
        aria-label="Navegación móvil"
      >
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`focus-ring flex min-h-14 min-w-20 flex-col items-center justify-center gap-1 rounded-xl px-3 text-[10px] font-bold ${
                active
                  ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                  : "text-[var(--muted)]"
              }`}
            >
              <Icon size={19} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
        {currentUser ? (
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="focus-ring flex min-h-14 min-w-20 flex-col items-center justify-center gap-1 rounded-xl px-3 text-[10px] font-bold text-[var(--muted)]"
              aria-label={`Cerrar sesión de ${currentUser.fullName}`}
            >
              <LogOut size={19} aria-hidden="true" />
              Salir
            </button>
          </form>
        ) : null}
      </nav>
    </>
  );
}

function navigationFor(currentUser: CurrentUser | null) {
  const links = [{ href: "/", label: "Inicio", icon: Home }];
  if (!currentUser) {
    return [...links, { href: "/login", label: "Ingresar", icon: LogIn }];
  }
  if (currentUser.role === "worker") {
    return [...links, { href: "/pedidos", label: "Mi pedido", icon: ClipboardCheck }];
  }
  if (currentUser.role === "company_admin") {
    return [...links, { href: "/admin/empresa", label: "Securitas", icon: Building2 }];
  }
  if (currentUser.role === "delivery") {
    return [...links, { href: "/despacho", label: "Despacho", icon: Truck }];
  }
  return [...links, { href: "/admin/proveedor", label: "Proveedor", icon: ChefHat }];
}
