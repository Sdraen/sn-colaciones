const CHILE_TIME_ZONE = "America/Santiago";
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const CHILEAN_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

const dateTimeFormatter = new Intl.DateTimeFormat("es-CL", {
  timeZone: CHILE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const weekdayFormatter = new Intl.DateTimeFormat("es-CL", {
  timeZone: "UTC",
  weekday: "long",
});

const shortWeekdayFormatter = new Intl.DateTimeFormat("es-CL", {
  timeZone: "UTC",
  weekday: "short",
});

export function formatChileanDate(value: string) {
  const parts = parseIsoDate(value);
  return parts ? `${parts.day}/${parts.month}/${parts.year}` : value;
}

export function formatChileanDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = Object.fromEntries(
    dateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year}, ${parts.hour}:${parts.minute}`;
}

export function formatChileanDateWithWeekday(value: string) {
  const date = isoDateToUtc(value);
  if (!date) return formatChileanDate(value);
  return `${capitalize(weekdayFormatter.format(date))} ${formatChileanDate(value)}`;
}

export function formatChileanTabDate(value: string) {
  const date = isoDateToUtc(value);
  if (!date) return formatChileanDate(value);
  return `${shortWeekdayFormatter.format(date).replace(".", "").toUpperCase()} ${formatChileanDate(value)}`;
}

export function parseChileanDate(value: string) {
  const match = CHILEAN_DATE_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, dayValue, monthValue, yearValue] = match;
  const day = dayValue.padStart(2, "0");
  const month = monthValue.padStart(2, "0");
  const isoDate = `${yearValue}-${month}-${day}`;
  return parseIsoDate(isoDate) ? isoDate : null;
}

function parseIsoDate(value: string) {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return { year, month, day };
}

function isoDateToUtc(value: string) {
  if (!parseIsoDate(value)) return null;
  return new Date(`${value}T12:00:00.000Z`);
}

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("es-CL") + value.slice(1);
}
