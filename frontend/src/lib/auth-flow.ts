import type { AppRole } from "@/lib/api/types";

export function isAdministrativeRole(role: AppRole) {
  return role === "provider_admin" || role === "company_admin";
}

export function homeByRole(role: AppRole) {
  if (role === "worker") return "/pedidos";
  if (role === "company_admin") return "/admin/empresa";
  if (role === "delivery") return "/despacho";
  return "/admin/proveedor";
}

export function safeNextPath(value: string | null | undefined, fallback = "/") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export function continuationPath(nextPath: string) {
  return `/auth/continuar?${new URLSearchParams({ next: safeNextPath(nextPath) })}`;
}

export function mfaPath(nextPath: string) {
  return `/mfa?${new URLSearchParams({ next: safeNextPath(nextPath) })}`;
}
