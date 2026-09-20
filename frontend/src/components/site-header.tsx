"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BellRing,
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
import { BrandMark } from "@/components/brand-logo";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { browserApiRequest } from "@/lib/api/client";
import type { NotificationDto } from "@/lib/api/contracts";
import type { CurrentUser } from "@/lib/api/types";
import { formatChileanDateTime } from "@/lib/date-format";

export function SiteHeader({
  currentUser,
  initialNotifications,
}: {
  currentUser: CurrentUser | null;
  initialNotifications: NotificationDto[];
}) {
  const pathname = usePathname();
  const links = navigationFor(currentUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [notificationError, setNotificationError] = useState("");
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  const refreshNotifications = useCallback(async () => {
    if (!currentUser) return;
    setNotifications(
      await browserApiRequest<NotificationDto[]>("/api/v1/notifications?limit=20"),
    );
  }, [currentUser]);
  const { refreshNow: refreshNotificationsNow } = useAutoRefresh(
    refreshNotifications,
    { enabled: Boolean(currentUser) },
  );

  useEffect(() => {
    if (!menuOpen && !notificationsOpen) return;

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setNotificationsOpen(false);
      }
    }

    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [menuOpen, notificationsOpen]);

  async function markNotificationRead(notification: NotificationDto) {
    if (notification.readAt) return;
    setNotificationError("");
    try {
      const updated = await browserApiRequest<NotificationDto>(
        `/api/v1/notifications/${notification.id}/read`,
        { method: "PATCH", body: JSON.stringify({}) },
      );
      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (caught) {
      setNotificationError(
        caught instanceof Error
          ? caught.message
          : "No fue posible marcar el aviso como leído.",
      );
    }
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[#fffdf8]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-18 w-[min(1180px,calc(100%_-_24px))] min-w-0 items-center justify-between gap-3 sm:w-[min(1180px,calc(100%_-_32px))] sm:gap-6">
          <Link href="/" className="focus-ring flex min-w-0 items-center gap-2.5 rounded-xl sm:gap-3">
            <BrandMark className="size-11 drop-shadow-sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold tracking-[-0.02em]">
                SN Colaciones
              </span>
              <span className="hidden truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)] min-[360px]:block">
                Cocina casera · Gestión diaria
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
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
            </nav>
            {currentUser ? (
              <button
                type="button"
                className="focus-ring relative grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-white text-[var(--foreground)] shadow-sm"
                aria-label={unreadCount > 0 ? `Notificaciones: ${unreadCount} sin leer` : "Notificaciones"}
                aria-expanded={notificationsOpen}
                aria-controls="notifications-panel"
                onClick={() => {
                  setMenuOpen(false);
                  setNotificationsOpen((open) => !open);
                  void refreshNotificationsNow();
                }}
              >
                <BellRing size={20} aria-hidden="true" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-black leading-none text-white shadow-sm">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            <button
              type="button"
              className="header-menu-button focus-ring grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-white text-[var(--foreground)] shadow-sm"
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuOpen}
              aria-controls="account-menu"
              onClick={() => {
                setNotificationsOpen(false);
                setMenuOpen((open) => !open);
              }}
            >
              <span className="header-menu-icon grid place-items-center">
                {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
              </span>
            </button>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-x-0 bottom-0 top-18 z-40 ${
          notificationsOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!notificationsOpen}
        inert={!notificationsOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-[#3b2418]/24 backdrop-blur-[2px] transition-opacity ${
            notificationsOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Cerrar notificaciones"
          onClick={() => setNotificationsOpen(false)}
        />
        <aside
          id="notifications-panel"
          className={`relative mx-3 mt-3 max-h-[calc(100dvh-96px)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[#fffdf8] shadow-2xl transition duration-200 md:ml-auto md:mr-6 md:max-w-sm ${
            notificationsOpen
              ? "translate-y-0 opacity-100"
              : "-translate-y-2 opacity-0"
          }`}
          aria-label="Notificaciones"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
            <div>
              <h2 className="font-black">Notificaciones</h2>
              <p className="text-xs text-[var(--muted)]">
                {unreadCount > 0 ? `${unreadCount} sin leer` : "No tienes avisos pendientes"}
              </p>
            </div>
            <button
              type="button"
              className="focus-ring grid size-10 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--surface-muted)]"
              aria-label="Cerrar notificaciones"
              onClick={() => setNotificationsOpen(false)}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="max-h-[calc(100dvh-180px)] overflow-y-auto p-3">
            {notificationError ? (
              <p role="alert" className="mb-2 rounded-xl bg-red-50 p-3 text-xs font-bold text-[var(--danger)]">
                {notificationError}
              </p>
            ) : null}
            {notifications.length > 0 ? (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    disabled={Boolean(notification.readAt)}
                    onClick={() => void markNotificationRead(notification)}
                    className={`focus-ring w-full rounded-xl border p-3 text-left transition ${
                      notification.readAt
                        ? "cursor-default border-transparent bg-[var(--surface-muted)] opacity-70"
                        : "border-[var(--line)] bg-white hover:border-[var(--brand)]"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <strong className="text-sm">{notification.title}</strong>
                      {!notification.readAt ? (
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-[var(--brand)]" aria-label="Sin leer" />
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--muted)]">
                      {notification.message}
                    </span>
                    <span className="mt-2 block text-[10px] font-bold text-[var(--muted)]">
                      {formatChileanDateTime(notification.createdAt)}
                      {!notification.readAt ? " · Toca para marcar como leído" : " · Leído"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-[var(--surface-muted)] p-6 text-center text-sm text-[var(--muted)]">
                No tienes notificaciones.
              </div>
            )}
          </div>
        </aside>
      </div>

      <div
        className={`account-menu-layer fixed inset-x-0 bottom-0 top-18 z-40 ${
          menuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        data-open={menuOpen}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <button
          type="button"
          className="account-menu-backdrop absolute inset-0 bg-[#3b2418]/24 backdrop-blur-[2px]"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
        />
        <nav
          id="account-menu"
          className="account-menu-panel relative mx-3 mt-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-[#fffdf8] p-3 shadow-2xl md:ml-auto md:mr-6 md:max-w-sm"
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
