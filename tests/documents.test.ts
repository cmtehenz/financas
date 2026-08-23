import { describe, expect, it } from "vitest";

import {
  detectDocumentContentType,
  documentSubjectForBill,
  documentSubjectForIncome,
  sanitizeDocumentFileName,
} from "@/domain/documents";
import { prepareDocumentFile } from "@/services/documents";

const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

describe("planner document subjects", () => {
  it("attaches income and ledger bills to the transaction", () => {
    expect(documentSubjectForIncome("tx-1")).toEqual({ subjectType: "TRANSACTION", subjectId: "tx-1" });
    expect(
      documentSubjectForBill({
        id: "ledger:tx-2",
        origin: "LEDGER",
        sourceId: "tx-2",
      }),
    ).toEqual({ subjectType: "TRANSACTION", subjectId: "tx-2" });
  });

  it("attaches card and debt rows to their own sources", () => {
    expect(
      documentSubjectForBill({
        id: "card:st-1",
        origin: "CARD",
        sourceId: "st-1",
        statementId: "st-1",
      }),
    ).toEqual({ subjectType: "CARD_STATEMENT", subjectId: "st-1" });
    expect(
      documentSubjectForBill({
        id: "debt:in-1",
        origin: "DEBT",
        sourceId: "in-1",
        installmentId: "in-1",
      }),
    ).toEqual({ subjectType: "DEBT_INSTALLMENT", subjectId: "in-1" });
  });

  it("skips the synthetic investment remainder", () => {
    expect(
      documentSubjectForBill({
        id: "investment:house:2026-09",
        origin: "INVESTMENT",
        sourceId: "investment:2026-09",
      }),
    ).toBeNull();
  });
});

describe("document files", () => {
  it("detects png and sanitizes the name", () => {
    expect(detectDocumentContentType(PNG, "image/png")).toBe("image/png");
    expect(sanitizeDocumentFileName("../../boleto.png")).toBe("....boleto.png");
  });

  it("rejects unknown bytes", () => {
    expect(() =>
      prepareDocumentFile({
        fileName: "malware.exe",
        contentType: "application/octet-stream",
        bytes: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
      }),
    ).toThrow(/PDF, JPG, PNG/);
  });
});
