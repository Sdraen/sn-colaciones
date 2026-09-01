export type OrderWindow =
  | "preorder_open"
  | "waiting_same_day"
  | "same_day_open"
  | "exceptional_open"
  | "closed";

function previousCalendarDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error("La fecha de servicio debe usar el formato YYYY-MM-DD");
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function dateTimeInChile(now: Date) {
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

export function getOrderWindow(serviceDate: string, now = new Date()): OrderWindow {
  const current = dateTimeInChile(now);
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

export function isTrainingDateAllowed(serviceDate: string, blocked = false) {
  const [year, month, day] = serviceDate.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined || blocked) {
    return false;
  }

  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

export function isTrainingWindowOpen(
  serviceDate: string,
  now = new Date(),
  blocked = false,
) {
  if (!isTrainingDateAllowed(serviceDate, blocked)) return false;
  const current = dateTimeInChile(now);
  if (serviceDate < current.date) return false;
  return current.minutes <= 9 * 60 || current.minutes >= 14 * 60;
}
