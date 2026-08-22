import { describe, expect, it } from "vitest";

import { addCents, formatBRL, formatCentsInput, subtractCents, toCents } from "@/lib/money";

describe("money helpers", () => {
  it("parses decimal strings into integer cents", () => {
    expect(toCents("10,50")).toBe(BigInt(1050));
    expect(toCents("1234,56")).toBe(BigInt(123456));
    expect(toCents("1.234,56")).toBe(BigInt(123456));
    expect(toCents("-3,09")).toBe(BigInt(-309));
  });

  it("rejects floating-point numbers", () => {
    expect(() => toCents(10.5)).toThrow(/Floating-point/);
  });

  it("adds and subtracts without floating point", () => {
    expect(addCents(BigInt(100), BigInt(250), BigInt(3))).toBe(BigInt(353));
    expect(subtractCents(BigInt(1000), BigInt(250))).toBe(BigInt(750));
  });

  it("formats Brazilian Real from cents", () => {
    expect(formatBRL(BigInt(0))).toBe("R$ 0,00");
    expect(formatBRL(BigInt(1050))).toBe("R$ 10,50");
    expect(formatBRL(BigInt(123456))).toBe("R$ 1.234,56");
    expect(formatBRL(BigInt(-90))).toBe("-R$ 0,90");
  });

  it("formats cents for form inputs without thousands separators", () => {
    expect(formatCentsInput(BigInt(123456))).toBe("1234,56");
  });
});
