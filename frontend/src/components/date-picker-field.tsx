"use client";

import { CalendarDays } from "lucide-react";
import { useRef } from "react";
import { formatChileanDate } from "@/lib/date-format";

export function DatePickerField({
  label,
  value,
  onChange,
  className = "",
  inputClassName = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openCalendar() {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  return (
    <label className={`grid gap-1 text-xs font-extrabold text-[var(--muted)] ${className}`}>
      {label}
      <span
        className={`date-picker-control form-control relative flex min-h-11 items-center px-3 pr-10 text-sm font-bold text-[var(--foreground)] ${inputClassName}`}
      >
        <span aria-hidden="true">
          {value ? formatChileanDate(value) : "Seleccionar fecha"}
        </span>
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onClick={openCalendar}
          aria-label={label}
          className="date-picker-input absolute inset-0 z-10 size-full cursor-pointer opacity-0"
        />
        <CalendarDays
          size={17}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        />
      </span>
    </label>
  );
}
