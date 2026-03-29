export type ExpenseDraftLike = {
  categoryId: string;
  amount: string;
  currencyCode: string;
  expenseDate: string;
  description: string;
  receiptUrl: string;
};

export function validateExpenseDraft(expenseForm: ExpenseDraftLike): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!expenseForm.categoryId) {
    errors.categoryId = "Select a category";
  }

  const parsedAmount = Number(expenseForm.amount);

  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    errors.amount = "Amount should be greater than zero";
  }

  if (!/^[A-Za-z]{3}$/.test(expenseForm.currencyCode)) {
    errors.currencyCode = "Use a valid 3-letter currency code";
  }

  if (!expenseForm.expenseDate) {
    errors.expenseDate = "Select the expense date";
  }

  if (expenseForm.description.trim().length < 3) {
    errors.description = "Description should be at least 3 characters";
  }

  if (expenseForm.receiptUrl.trim() && !/^https?:\/\/.+/i.test(expenseForm.receiptUrl.trim())) {
    errors.receiptUrl = "Receipt link should be a valid URL";
  }

  return errors;
}
