export function todayInSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export function dateInSaoPaulo(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(value);
}

export function pad2(value: number) {
  return value.toString().padStart(2, "0");
}

export function yearMonth(year: number, month: number) {
  return `${year}-${pad2(month)}`;
}

export function parseYearMonth(value: string | null | undefined, fallback = todayInSaoPaulo()) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    const [year, month] = fallback.split("-");
    return { year: Number(year), month: Number(month) };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    const [fallbackYear, fallbackMonth] = fallback.split("-");
    return { year: Number(fallbackYear), month: Number(fallbackMonth) };
  }

  return { year, month };
}

export function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthStart(year: number, month: number) {
  return `${yearMonth(year, month)}-01`;
}

export function monthEnd(year: number, month: number) {
  return `${yearMonth(year, month)}-${pad2(lastDayOfMonth(year, month))}`;
}

export function addMonths(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(index / 12),
    month: (index % 12) + 1,
  };
}

export function compareIsoDate(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function clampDueDay(year: number, month: number, dueDay: number) {
  return Math.min(Math.max(dueDay, 1), lastDayOfMonth(year, month));
}

export function occurrenceDate(year: number, month: number, dueDay: number) {
  return `${yearMonth(year, month)}-${pad2(clampDueDay(year, month, dueDay))}`;
}

export function occurrenceKey(year: number, month: number) {
  return yearMonth(year, month);
}

export function shiftYearMonth(value: string, delta: number) {
  const parsed = parseYearMonth(value);
  const next = addMonths(parsed.year, parsed.month, delta);
  return yearMonth(next.year, next.month);
}
