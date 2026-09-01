export type BookingPhase =
  | "preorder_open"
  | "waiting_same_day"
  | "same_day_open"
  | "exceptional_open"
  | "closed";

export const ORDER_SCHEDULE = {
  preorderCloses: "22:00",
  sameDayOpens: "08:00",
  sameDayCloses: "11:00",
  deliveryCloses: "13:00",
} as const;

function previousCalendarDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function chileDateTime(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

export function getBookingPhase(serviceDate: string, now = new Date()): BookingPhase {
  const current = chileDateTime(now);
  const previousDate = previousCalendarDate(serviceDate);

  if (current.date < previousDate) return "preorder_open";
  if (current.date === previousDate && current.minutes <= 22 * 60) {
    return "preorder_open";
  }
  if (current.date < serviceDate) return "waiting_same_day";
  if (current.date > serviceDate) return "closed";
  if (current.minutes < 8 * 60) return "waiting_same_day";
  if (current.minutes < 11 * 60) return "same_day_open";
  if (current.minutes < 13 * 60) return "exceptional_open";
  return "closed";
}

export function canPlaceRegularOrder(phase: BookingPhase) {
  return phase === "preorder_open";
}

export function isWeekday(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

export function isTrainingRegistrationOpen(
  serviceDate: string,
  now = new Date(),
  blocked = false,
) {
  if (blocked || !isWeekday(serviceDate)) return false;
  const current = chileDateTime(now);
  if (serviceDate < current.date) return false;
  return current.minutes <= 9 * 60 || current.minutes >= 14 * 60;
}

export const bookingPhaseCopy: Record<
  BookingPhase,
  { title: string; description: string }
> = {
  preorder_open: {
    title: "Reserva anticipada disponible",
    description: "Puedes reservar este día hasta las 22:00 del día anterior.",
  },
  waiting_same_day: {
    title: "Pedido normal temporalmente cerrado",
    description: "La disponibilidad del mismo día se publica entre las 08:00 y las 11:00.",
  },
  same_day_open: {
    title: "Pedido de trabajador cerrado",
    description: "Sólo la administradora de Securitas puede ingresar colaciones disponibles hasta las 11:00.",
  },
  exceptional_open: {
    title: "Colación extra con aprobación",
    description: "Entre las 11:00 y las 13:00 la proveedora debe aprobar o rechazar la solicitud.",
  },
  closed: {
    title: "Día cerrado",
    description: "Ya no se reciben pedidos para esta fecha.",
  },
};
