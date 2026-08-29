import type { PostgrestError } from "@supabase/supabase-js";
import { AppError } from "../errors/app-error.js";

const domainErrors: Record<string, { status: number; message: string }> = {
  AUTH_REQUIRED: { status: 401, message: "Debes iniciar sesión" },
  BREAD_OR_TEA_REQUIRED: { status: 422, message: "Debes elegir pan o té, pero no ambos" },
  CALENDAR_BLOCK_NOT_FOUND: { status: 404, message: "No se encontró el bloqueo de calendario" },
  COMPANY_ROLE_REQUIRED: { status: 403, message: "Esta acción requiere el rol de administradora de Securitas" },
  DINER_NOT_FOUND: { status: 422, message: "El trabajador no tiene un comensal activo asociado" },
  EXCEPTION_ALREADY_RESOLVED: { status: 409, message: "La solicitud extraordinaria ya fue resuelta" },
  EXCEPTION_NOT_FOUND: { status: 404, message: "No se encontró la solicitud extraordinaria" },
  EXCEPTION_NOT_APPROVED: { status: 409, message: "La solicitud extraordinaria todavía no está aprobada" },
  EXCEPTION_WINDOW_CLOSED: { status: 409, message: "La ventana extraordinaria está cerrada" },
  EXTRA_WINDOW_CLOSED: { status: 409, message: "Las colaciones extra solo se registran entre las 08:00 y las 11:00" },
  MENU_OPTION_NOT_FOUND: { status: 404, message: "No se encontró la alternativa de menú" },
  MENU_OPTION_NOT_AVAILABLE: { status: 409, message: "La alternativa seleccionada no está disponible" },
  MENU_OPTION_CAPACITY_EXCEEDED: { status: 409, message: "Ya no queda disponibilidad para esa alternativa" },
  MENU_DAY_WITHOUT_OPTIONS: { status: 422, message: "Cada día habilitado necesita al menos una alternativa" },
  MENU_WEEK_LOCKED: { status: 409, message: "El borrador ya tiene operaciones asociadas y no se puede reemplazar" },
  MENU_WEEK_NOT_FOUND: { status: 404, message: "No se encontró la semana de menú" },
  MENU_WEEK_NOT_PUBLISHED: { status: 409, message: "La semana de menú todavía no está publicada" },
  MENU_WEEK_MUST_BE_NEXT: { status: 422, message: "Sólo puedes administrar el menú de la semana siguiente" },
  MENU_WEEK_PUBLISHED: { status: 409, message: "Un menú publicado no se puede reemplazar" },
  NOTIFICATION_NOT_FOUND: { status: 404, message: "No se encontró la notificación" },
  ORDER_NOT_FOUND: { status: 404, message: "No se encontró el pedido" },
  ORDER_WINDOW_CLOSED: { status: 409, message: "La ventana para reservar esta colación está cerrada" },
  PROVIDER_ROLE_REQUIRED: { status: 403, message: "Esta acción requiere el rol de proveedora" },
  SERVICE_DAY_DISABLED: { status: 409, message: "El día seleccionado no tiene servicio" },
  TRAINING_DATE_BLOCKED: { status: 409, message: "No se permiten capacitaciones en esta fecha" },
  TRAINING_MENU_REQUIRED: { status: 409, message: "La proveedora todavía no ha definido el menú de capacitación para ese día" },
  TRAINING_SESSION_MISMATCH: { status: 409, message: "La capacitación no corresponde al día seleccionado" },
  TRAINING_WINDOW_CLOSED: { status: 409, message: "Las capacitaciones se registran el mismo día entre las 00:00 y las 09:00" },
  WORKER_ROLE_REQUIRED: { status: 403, message: "Esta acción requiere el rol de trabajador" },
};

export function throwSupabaseError(
  error: PostgrestError,
  fallbackMessage = "No fue posible completar la operación en la base de datos",
): never {
  const domainError = domainErrors[error.message];
  if (domainError) {
    throw new AppError(domainError.message, domainError.status, error.message);
  }
  if (error.code === "23505") {
    throw new AppError("El registro ya existe", 409, "DUPLICATE_RECORD");
  }
  if (error.code === "23503") {
    throw new AppError("La operación hace referencia a un registro inexistente", 409, "INVALID_REFERENCE");
  }
  if (error.code === "23514") {
    throw new AppError("La operación no cumple las reglas de datos", 422, "DATABASE_CONSTRAINT");
  }
  if (error.code === "22023") {
    throw new AppError("Los datos enviados no son válidos", 400, "INVALID_DATABASE_INPUT", {
      reason: error.message,
    });
  }
  if (error.code === "42501") {
    throw new AppError("La base de datos rechazó esta operación", 403, "DATABASE_FORBIDDEN");
  }

  throw new AppError(fallbackMessage, 503, "DATABASE_ERROR", {
    databaseCode: error.code,
  });
}
