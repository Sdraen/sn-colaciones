"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  ChefHat,
  ClipboardCheck,
  Home,
  LogIn,
  LogOut,
  Menu,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import type { CurrentUser } from "@/lib/api/types";

export function SiteHeader({
  currentUser,
}: {
  currentUser: CurrentUser | null;
}) {
  const pathname = usePathname();
  const links = navigationFor(currentUser);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[#fffdf8]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-18 w-[min(1180px,calc(100%_-_24px))] min-w-0 items-center justify-between gap-3 sm:w-[min(1180px,calc(100%_-_32px))] sm:gap-6">
          <Link href="/" className="focus-ring flex min-w-0 items-center gap-2.5 rounded-xl sm:gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--brand),var(--accent))] text-white shadow-lg shadow-orange-950/15">
              <ChefHat size={21} strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold tracking-[-0.02em]">
                SN Colaciones
              </span>
              <span className="hidden truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)] min-[360px]:block">
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
                  aria-current={active ? "page" : undefined}
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
          <button
            type="button"
            className="focus-ring grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-white text-[var(--foreground)] shadow-sm md:hidden"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="mobile-account-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-x-0 bottom-0 top-18 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#3b2418]/24 backdrop-blur-[2px]"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            id="mobile-account-menu"
            className="relative mx-3 mt-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-[#fffdf8] p-3 shadow-2xl"
            aria-label="Navegación y cuenta"
          >
            {currentUser ? (
              <div className="mb-3 flex min-w-0 items-center gap-3 rounded-xl bg-[var(--surface-muted)] p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-strong)]">
                  <UserRound size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">{currentUser.fullName}</p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {currentUser.email ?? "Cuenta sin correo"}
                  </p>
                  <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--brand-strong)]">
                    {roleLabel(currentUser.role)}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-1">
              {links.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={`focus-ring flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-extrabold ${
                      active
                        ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                        : "text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    <Icon size={19} aria-hidden="true" />
                    {label}
                  </Link>
                );
              })}
            </div>

            {currentUser ? (
              <form action="/auth/signout" method="post" className="mt-2 border-t border-[var(--line)] pt-2">
                <button
                  type="submit"
                  className="focus-ring flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-extrabold text-[var(--danger)] hover:bg-red-50"
                  aria-label={`Cerrar sesión de ${currentUser.fullName}`}
                >
                  <LogOut size={19} aria-hidden="true" />
                  Cerrar sesión
                </button>
              </form>
            ) : null}
          </nav>
        </div>
      ) : null}
    </>
  );
}

function roleLabel(role: CurrentUser["role"]) {
  if (role === "worker") return "Trabajador";
  if (role === "company_admin") return "Administración Securitas";
  if (role === "delivery") return "Despacho";
  return "Administración proveedora";
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
