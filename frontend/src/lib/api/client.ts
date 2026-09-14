import { createClient } from "@/lib/supabase/client";
import { getApiUrl } from "./config";
import type { ApiErrorPayload } from "./types";

export async function browserApiRequest<T>(path: string, init: RequestInit = {}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Debes iniciar sesión");

  const response = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${session.access_token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as
    | { data?: T }
    | ApiErrorPayload;
  if (!response.ok) {
    const apiError = "error" in payload ? payload.error : undefined;
    throw new Error(apiError?.message ?? "No fue posible completar la solicitud");
  }
  if (!("data" in payload)) throw new Error("La API devolvió una respuesta inesperada");
  return payload.data as T;
}

export async function browserApiDownload(path: string) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Debes iniciar sesión");

  const response = await fetch(`${getApiUrl()}${path}`, {
    headers: {
      accept: "application/pdf",
      authorization: `Bearer ${session.access_token}`,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new Error(payload.error?.message ?? "No fue posible descargar el archivo");
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  return { blob: await response.blob(), fileName };
}
