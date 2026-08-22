import type { Cents } from "@/types/money";

const ZERO = BigInt(0);
const CENTS_PER_REAL = BigInt(100);

export function toCents(value: Cents | number | string): Cents {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error("Use integer cents or a decimal string. Floating-point money is not allowed.");
    }

    return BigInt(value);
  }

  const normalized = value.trim().replace(/\s/g, "").replace("R$", "");
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const compact = unsigned.includes(",") ? unsigned.replace(/\./g, "") : unsigned;

  if (!/^\d+([.,]\d{1,2})?$/.test(compact)) {
    throw new Error("Invalid money amount.");
  }

  const [wholePart = "0", fractionPart = ""] = compact.replace(",", ".").split(".");
  const fraction = `${fractionPart}00`.slice(0, 2);
  const cents = BigInt(wholePart) * CENTS_PER_REAL + BigInt(fraction);

  return negative ? -cents : cents;
}

export function addCents(...values: Cents[]): Cents {
  return values.reduce<Cents>((total, value) => total + value, ZERO);
}

export function subtractCents(minuend: Cents, subtrahend: Cents): Cents {
  return minuend - subtrahend;
}

export function maxCents(left: Cents, right: Cents): Cents {
  return left > right ? left : right;
}

export function formatBRL(cents: Cents): string {
  const negative = cents < ZERO;
  const absolute = negative ? -cents : cents;
  const whole = absolute / CENTS_PER_REAL;
  const fraction = (absolute % CENTS_PER_REAL).toString().padStart(2, "0");
  const groupedWhole = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${negative ? "-" : ""}R$ ${groupedWhole},${fraction}`;
}

export function formatCentsInput(cents: Cents): string {
  const negative = cents < ZERO;
  const absolute = negative ? -cents : cents;
  const whole = absolute / CENTS_PER_REAL;
  const fraction = (absolute % CENTS_PER_REAL).toString().padStart(2, "0");

  return `${negative ? "-" : ""}${whole.toString()},${fraction}`;
}
