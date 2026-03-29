import { readFile } from "node:fs/promises";

import { Prisma } from "@prisma/client";
import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";

import { env } from "../../config/env.js";

export type ReceiptInsightSummary = {
  rawText: string | null;
  confidence: string | null;
  amount: string | null;
  currency: string | null;
  expenseDate: Date | null;
  merchantName: string | null;
  suggestedDescription: string | null;
  suggestedCategoryName: string | null;
  status: "COMPLETED" | "FAILED" | "NOT_SUPPORTED";
  errorMessage: string | null;
};

const currencySymbolMap: Record<string, string> = {
  "₹": "INR",
  "$": "USD",
  "€": "EUR",
  "£": "GBP"
};

const categoryKeywordMap: Array<{ categoryName: string; keywords: string[] }> = [
  { categoryName: "Food", keywords: ["restaurant", "cafe", "coffee", "lunch", "dinner", "meal", "food"] },
  { categoryName: "Travel", keywords: ["taxi", "uber", "ola", "flight", "airport", "rail", "train", "bus", "travel"] },
  { categoryName: "Accommodation", keywords: ["hotel", "stay", "inn", "lodging", "booking"] },
  { categoryName: "Fuel", keywords: ["petrol", "diesel", "fuel", "gas station"] },
  { categoryName: "Office Supplies", keywords: ["stationery", "office", "printer", "paper", "supplies"] }
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
}

function parseDateCandidate(value: string): Date | null {
  const normalizedValue = value.trim();
  const isoLikeMatch = normalizedValue.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);

  if (isoLikeMatch) {
    const [, yearValue, monthValue, dayValue] = isoLikeMatch;
    return new Date(Date.UTC(Number(yearValue), Number(monthValue) - 1, Number(dayValue)));
  }

  const dayMonthYearMatch = normalizedValue.replace(/[.,]/g, "/").replace(/-/g, "/").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);

  if (!dayMonthYearMatch) {
    return null;
  }

  const [, dayValue, monthValue, yearValue] = dayMonthYearMatch;
  const year = yearValue.length === 2 ? Number(`20${yearValue}`) : Number(yearValue);
  const parsedDate = new Date(Date.UTC(year, Number(monthValue) - 1, Number(dayValue)));

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function extractAmountAndCurrencyFromLine(line: string): { amount: string; currency: string | null } | null {
  const directCurrencyMatch = line.match(/\b([A-Z]{3})\s*([0-9]+(?:[.,][0-9]{2})?)\b/);

  if (directCurrencyMatch) {
    return {
      currency: directCurrencyMatch[1],
      amount: directCurrencyMatch[2].replace(/,/g, "")
    };
  }

  const symbolCurrencyMatch = line.match(/([₹$€£])\s*([0-9]+(?:[.,][0-9]{2})?)/);

  if (symbolCurrencyMatch) {
    return {
      currency: currencySymbolMap[symbolCurrencyMatch[1]] ?? null,
      amount: symbolCurrencyMatch[2].replace(/,/g, "")
    };
  }

  const numericMatch = line.match(/\b([0-9]+(?:[.,][0-9]{2})?)\b/);

  if (!numericMatch) {
    return null;
  }

  return {
    currency: null,
    amount: numericMatch[1].replace(/,/g, "")
  };
}

export function extractReceiptInsightsFromText(rawText: string): Omit<ReceiptInsightSummary, "status" | "errorMessage"> {
  const normalizedText = normalizeWhitespace(rawText);
  const lines = normalizedText
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  let amount: string | null = null;
  let currency: string | null = null;
  let expenseDate: Date | null = null;
  let merchantName: string | null = null;

  const amountPriorityLines = lines.filter((line) => /(grand total|total|amount paid|amount|net amount|invoice total)/i.test(line));
  const candidateAmountLines = [...amountPriorityLines, ...lines];

  for (const line of candidateAmountLines) {
    const extractedAmount = extractAmountAndCurrencyFromLine(line);

    if (extractedAmount) {
      amount = extractedAmount.amount;
      currency = extractedAmount.currency;
      break;
    }
  }

  for (const line of lines) {
    const matchedDate = line.match(/(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})/);

    if (matchedDate) {
      expenseDate = parseDateCandidate(matchedDate[1]);

      if (expenseDate) {
        break;
      }
    }
  }

  merchantName =
    lines.find((line) => /[A-Za-z]/.test(line) && !/(invoice|receipt|tax|gst|bill to|paid by|cashier)/i.test(line)) ??
    null;

  const lowerCaseText = normalizedText.toLowerCase();
  const suggestedCategoryName =
    categoryKeywordMap.find((entry) => entry.keywords.some((keyword) => lowerCaseText.includes(keyword)))?.categoryName ??
    "Miscellaneous";
  const suggestedDescription = merchantName ? `${merchantName} receipt` : "Receipt-based expense";

  return {
    rawText: normalizedText || null,
    confidence: null,
    amount,
    currency,
    expenseDate,
    merchantName,
    suggestedDescription,
    suggestedCategoryName
  };
}

async function extractTextFromPdf(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const parser = new PDFParse({ data: buffer });

  try {
    const textResult = await parser.getText();
    return textResult.text;
  } finally {
    await parser.destroy();
  }
}

async function extractTextFromImage(filePath: string): Promise<{ text: string; confidence: string | null }> {
  const worker = await createWorker(env.ocrLanguage);

  try {
    const result = await worker.recognize(filePath);
    return {
      text: result.data.text,
      confidence:
        typeof result.data.confidence === "number" && !Number.isNaN(result.data.confidence)
          ? result.data.confidence.toFixed(2)
          : null
    };
  } finally {
    await worker.terminate();
  }
}

function toDecimal(value: string | null): Prisma.Decimal | null {
  if (!value) {
    return null;
  }

  return new Prisma.Decimal(value);
}

export function mapReceiptInsightToPersistence(insight: ReceiptInsightSummary) {
  return {
    ocrStatus: insight.status,
    ocrErrorMessage: insight.errorMessage,
    ocrRawText: insight.rawText,
    ocrConfidence: toDecimal(insight.confidence),
    extractedAmount: toDecimal(insight.amount),
    extractedCurrency: insight.currency,
    extractedDate: insight.expenseDate,
    extractedMerchantName: insight.merchantName,
    suggestedDescription: insight.suggestedDescription,
    suggestedCategoryName: insight.suggestedCategoryName,
    extractionReviewed: false
  };
}

export async function extractReceiptInsightsFromFile(filePath: string, mimeType: string): Promise<ReceiptInsightSummary> {
  try {
    let rawText = "";
    let confidence: string | null = null;

    if (mimeType === "application/pdf") {
      rawText = await extractTextFromPdf(filePath);
    } else if (mimeType.startsWith("image/")) {
      const imageResult = await extractTextFromImage(filePath);
      rawText = imageResult.text;
      confidence = imageResult.confidence;
    } else if (mimeType === "text/plain") {
      rawText = await readFile(filePath, "utf8");
    } else {
      return {
        rawText: null,
        confidence: null,
        amount: null,
        currency: null,
        expenseDate: null,
        merchantName: null,
        suggestedDescription: null,
        suggestedCategoryName: null,
        status: "NOT_SUPPORTED",
        errorMessage: "OCR currently supports image, PDF, and text receipts."
      };
    }

    const parsedInsight = extractReceiptInsightsFromText(rawText);

    return {
      ...parsedInsight,
      confidence: confidence ?? parsedInsight.confidence,
      status: "COMPLETED",
      errorMessage: null
    };
  } catch (error) {
    return {
      rawText: null,
      confidence: null,
      amount: null,
      currency: null,
      expenseDate: null,
      merchantName: null,
      suggestedDescription: null,
      suggestedCategoryName: null,
      status: "FAILED",
      errorMessage: error instanceof Error ? error.message : "OCR processing failed"
    };
  }
}
