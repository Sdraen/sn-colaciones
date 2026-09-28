import type { PostgrestError } from "@supabase/supabase-js";
import { AppError } from "../errors/app-error.js";

const domainErrors: Record<string, { status: number; message: string }> = {
  MFA_REQUIRED: { status: 403, message: "Debes verificar el codigo de autenticacion para continuar" },
  ACCESS_ACCOUNT_NOT_FOUND: { status: 404, message: "No se encontro la cuenta de acceso" },
  AUTH_REQUIRED: { status: 401, message: "Debes iniciar sesión" },
  BREAD_OR_TEA_REQUIRED: { status: 422, message: "Debes elegir pan, té o ambos" },
  WORKER_BREAD_OR_TEA_REQUIRED: { status: 422, message: "Debes elegir pan o té" },
  CALENDAR_BLOCK_NOT_FOUND: { status: 404, message: "No se encontró el bloqueo de calendario" },
  COMPANY_ROLE_REQUIRED: { status: 403, message: "Esta acción requiere el rol de administradora de Securitas" },
  COMPANY_ARRIVAL_REQUIRED: { status: 409, message: "Securitas debe confirmar primero que la comida llegó" },
  DINER_NOT_FOUND: { status: 422, message: "El trabajador no tiene un comensal activo asociado" },
  DELIVERY_ARRIVAL_REQUIRED: { status: 409, message: "Primero debes registrar la llegada a Securitas" },
  DELIVERY_COMPLETION_REQUIRED: { status: 409, message: "Despacho todavía no ha marcado la entrega como terminada" },
  DELIVERY_ALREADY_COMPLETED: { status: 409, message: "El registro ya no se puede modificar porque la entrega terminó" },
  DELIVERY_DAY_MISMATCH: { status: 409, message: "El avance de despacho solo se puede registrar para el día actual" },
  DELIVERY_ROLE_REQUIRED: { status: 403, message: "Esta acción requiere el rol de despacho" },
  DELIVERY_EVENT_ROLE_REQUIRED: { status: 403, message: "Esta acción requiere el rol de despacho o de administradora Securitas" },
  DELIVERY_RECEIPT_HAS_SHORTAGES: { status: 409, message: "Aún existen faltantes pendientes en el control de recepción" },
  DAILY_DESSERT_NOT_AVAILABLE: { status: 409, message: "El postre no está disponible para este día" },
  DAILY_DESSERT_CAPACITY_EXCEEDED: { status: 409, message: "No quedan cupos disponibles para el postre de este día" },
  DAILY_DESSERT_CAPACITY_BELOW_RESERVATIONS: { status: 409, message: "El cupo del postre no puede ser menor que sus reservas confirmadas" },
  DAILY_DESSERT_HAS_RESERVATIONS: { status: 409, message: "No puedes quitar un postre que ya tiene reservas" },
  DAILY_DESSERT_CONFLICTS_WITH_FRUIT_RESERVATIONS: { status: 409, message: "No puedes agregar postre porque este día ya tiene reservas de fruta" },
  EXCEPTION_ALREADY_RESOLVED: { status: 409, message: "La solicitud de colación extra ya fue resuelta" },
  EXCEPTION_NOT_FOUND: { status: 404, message: "No se encontró la solicitud de colación extra" },
  EXCEPTION_NOT_APPROVED: { status: 409, message: "La solicitud de colación extra todavía no está aprobada" },
  EXCEPTION_WINDOW_CLOSED: { status: 409, message: "La ventana de colaciones extra está cerrada" },
  EXTRA_WINDOW_CLOSED: { status: 409, message: "Las colaciones extra solo se registran entre las 08:00 y las 11:00" },
  EXTRA_APPROVAL_WINDOW_CLOSED: { status: 409, message: "Las solicitudes de colación extra cierran a las 13:00" },
  EXTRA_ALREADY_RESOLVED: { status: 409, message: "La solicitud de colación extra ya fue resuelta" },
  EXTRA_REQUEST_NOT_FOUND: { status: 404, message: "No se encontró la solicitud de colación extra" },
  EXTRA_REQUEST_LOCKED: { status: 409, message: "Sólo se pueden modificar solicitudes de colación extra pendientes" },
  EXTRA_NOT_APPROVED: { status: 409, message: "La solicitud de colación extra todavía no está aprobada" },
  INVALID_EXTRA_QUANTITY: { status: 422, message: "Ingresa entre 1 y 500 colaciones extra" },
  INVALID_EXTRA_ITEMS: { status: 422, message: "Selecciona entre 1 y 10 preparaciones distintas con cantidades vÃ¡lidas" },
  INVALID_TRAINING_ITEMS: { status: 422, message: "Selecciona entre 1 y 10 preparaciones de capacitaciÃ³n distintas con cantidades vÃ¡lidas" },
  EXTRA_QUANTITY_MISMATCH: { status: 409, message: "La cantidad del pedido no coincide con la solicitud aprobada" },
  MENU_OPTION_NOT_FOUND: { status: 404, message: "No se encontró la alternativa de menú" },
  MENU_OPTION_NOT_AVAILABLE: { status: 409, message: "La alternativa seleccionada no está disponible" },
  MENU_OPTION_CAPACITY_EXCEEDED: { status: 409, message: "La cantidad solicitada supera los cupos disponibles para esa alternativa" },
  MENU_EDIT_CONFIRMATION_REQUIRED: { status: 409, message: "Este cambio afecta reservas existentes y necesita confirmación" },
  MENU_OPTION_HAS_RESERVATIONS: { status: 409, message: "No puedes eliminar una alternativa con reservas; reemplaza su preparación para conservar los pedidos" },
  MENU_DAY_HAS_RESERVATIONS: { status: 409, message: "No puedes dejar sin servicio un día que ya tiene reservas" },
  MENU_CAPACITY_BELOW_RESERVATIONS: { status: 409, message: "El cupo total no puede ser menor que las reservas confirmadas" },
  DESSERT_ONLY_WEDNESDAY: { status: 409, message: "El postre sólo está disponible los miércoles" },
  INVALID_WORKER_SIDE: { status: 400, message: "Debes elegir ensalada, fruta o el postre disponible" },
  INVALID_SIDE_CHOICE: { status: 400, message: "Debes elegir un acompañamiento disponible" },
  FRUIT_NOT_AVAILABLE_WITH_DESSERT: { status: 409, message: "La fruta no está disponible porque este día ofrece postre" },
  MENU_DAY_WITHOUT_OPTIONS: { status: 422, message: "Cada día habilitado necesita al menos una alternativa" },
  MENU_WEEK_LOCKED: { status: 409, message: "El borrador ya tiene operaciones asociadas y no se puede reemplazar" },
  MENU_WEEK_NOT_FOUND: { status: 404, message: "No se encontró la semana de menú" },
  MENU_WEEK_NOT_PUBLISHED: { status: 409, message: "La semana de menú todavía no está publicada" },
  MENU_WEEK_MUST_BE_NEXT: { status: 422, message: "Sólo puedes administrar el menú de la semana siguiente" },
  MENU_WEEK_PUBLISHED: { status: 409, message: "Un menú publicado no se puede reemplazar" },
  MENU_WEEK_IS_IN_THE_PAST: { status: 409, message: "Una semana finalizada ya no se puede modificar" },
  MENU_WEEK_INCOMPLETE: { status: 422, message: "Completa la preparación y disponibilidad de todos los días antes de guardar" },
  INVALID_DELIVERY_EVENT: { status: 400, message: "El evento de despacho no es válido" },
  INVALID_RECEIPT_ITEMS: { status: 400, message: "El conteo de recepción contiene datos inválidos" },
  INVALID_RECEIPT_NOTE: { status: 400, message: "La observación de recepción es demasiado extensa" },
  NOTIFICATION_NOT_FOUND: { status: 404, message: "No se encontró la notificación" },
  OPERATION_HISTORY_LOCKED: { status: 409, message: "Los registros de días anteriores no se pueden modificar" },
  OPERATION_NOT_FOUND: { status: 404, message: "No se encontró la capacitación o colación extra" },
  ORDER_NOT_FOUND: { status: 404, message: "No se encontró el pedido" },
  ORDER_WINDOW_CLOSED: { status: 409, message: "La ventana para reservar esta colación está cerrada" },
  PROVIDER_ROLE_REQUIRED: { status: 403, message: "Esta acción requiere el rol de proveedora" },
  RECEIPT_CHECK_REQUIRED: { status: 409, message: "Primero debes revisar y guardar las cantidades recibidas" },
  RECEIPT_ALREADY_CONFIRMED: { status: 409, message: "La recepción ya fue confirmada y no se puede modificar" },
  RECEIPT_ITEMS_MISMATCH: { status: 409, message: "El resumen cambió; actualiza la página antes de guardar la recepción" },
  SERVICE_DAY_DISABLED: { status: 409, message: "El día seleccionado no tiene servicio" },
  SERVICE_DAY_NOT_FOUND: { status: 404, message: "No se encontró el día de servicio" },
  TRAINING_DATE_BLOCKED: { status: 409, message: "No se permiten capacitaciones en esta fecha" },
  TRAINING_CAPACITY_REQUIRED: { status: 409, message: "La proveedora debe informar la disponibilidad de capacitación para ese día" },
  TRAINING_CAPACITY_EXCEEDED: { status: 409, message: "La cantidad de alumnos supera los cupos de capacitación disponibles para ese día" },
  TRAINING_MENU_REQUIRED: { status: 409, message: "La proveedora todavía no ha definido el menú de capacitación para ese día" },
  TRAINING_SESSION_MISMATCH: { status: 409, message: "La capacitación no corresponde al día seleccionado" },
  TRAINING_WINDOW_CLOSED: { status: 409, message: "Hasta las 09:00 se permiten capacitaciones para hoy o fechas futuras; desde las 14:00, solo para fechas futuras" },
  WORKER_ROLE_REQUIRED: { status: 403, message: "Esta acción requiere el rol de trabajador" },
  WORKER_NOT_FOUND: { status: 404, message: "No se encontro el trabajador" },
};

export function throwSupabaseError(
  error: PostgrestError,
  fallbackMessage = "No fue posible completar la operación en la base de datos",
): never {
  console.error("[supabase] operación rechazada", {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

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
