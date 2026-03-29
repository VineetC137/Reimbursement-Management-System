import { describe, expect, it } from "vitest";

import { extractReceiptInsightsFromText } from "./receipt-ocr.service.js";

describe("extractReceiptInsightsFromText", () => {
  it("extracts amount, currency, merchant, category, and date from receipt text", () => {
    const result = extractReceiptInsightsFromText(`
      Blue Tokai Coffee
      Tax Invoice
      Date: 24/03/2026
      Grand Total INR 485.50
      Thank you for visiting
    `);

    expect(result.amount).toBe("485.50");
    expect(result.currency).toBe("INR");
    expect(result.merchantName).toBe("Blue Tokai Coffee");
    expect(result.suggestedCategoryName).toBe("Food");
    expect(result.expenseDate?.toISOString().slice(0, 10)).toBe("2026-03-24");
  });

  it("falls back to miscellaneous when category keywords are absent", () => {
    const result = extractReceiptInsightsFromText(`
      Vendor Billing Center
      Invoice total USD 120.00
      Date: 2026-03-01
    `);

    expect(result.amount).toBe("120.00");
    expect(result.currency).toBe("USD");
    expect(result.suggestedCategoryName).toBe("Miscellaneous");
  });
});
