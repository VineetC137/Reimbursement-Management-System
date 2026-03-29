import { describe, expect, it } from "vitest";

import { validateExpenseDraft } from "./expense-form";

describe("validateExpenseDraft", () => {
  it("returns errors for invalid values", () => {
    const errors = validateExpenseDraft({
      categoryId: "",
      amount: "0",
      currencyCode: "R",
      expenseDate: "",
      description: "ok",
      receiptUrl: "invalid-link"
    });

    expect(errors.categoryId).toBe("Select a category");
    expect(errors.amount).toBe("Amount should be greater than zero");
    expect(errors.currencyCode).toBe("Use a valid 3-letter currency code");
    expect(errors.expenseDate).toBe("Select the expense date");
    expect(errors.description).toBe("Description should be at least 3 characters");
    expect(errors.receiptUrl).toBe("Receipt link should be a valid URL");
  });

  it("returns no errors for a valid expense draft", () => {
    const errors = validateExpenseDraft({
      categoryId: "travel-id",
      amount: "1250.50",
      currencyCode: "INR",
      expenseDate: "2026-03-29",
      description: "Client taxi from airport",
      receiptUrl: "https://example.com/receipt.png"
    });

    expect(errors).toEqual({});
  });
});
