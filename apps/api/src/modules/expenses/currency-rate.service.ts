import { Prisma } from "@prisma/client";

import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";

type ExchangeRateProviderPayload = {
  base?: string;
  rates?: Record<string, number>;
};

export type ResolvedExchangeRate = {
  rate: Prisma.Decimal;
  fetchedAt: Date;
  expiresAt: Date;
  source: string;
  fromCache: boolean;
};

function buildProviderUrl(baseCurrency: string): string {
  return env.exchangeRateApiUrlTemplate.replace("{BASE_CURRENCY}", encodeURIComponent(baseCurrency));
}

export async function resolveExchangeRate(
  companyId: string,
  baseCurrency: string,
  quoteCurrency: string
): Promise<ResolvedExchangeRate> {
  const normalizedBaseCurrency = baseCurrency.trim().toUpperCase();
  const normalizedQuoteCurrency = quoteCurrency.trim().toUpperCase();

  if (normalizedBaseCurrency === normalizedQuoteCurrency) {
    const now = new Date();

    return {
      rate: new Prisma.Decimal(1),
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + env.currencyRateCacheMaxAgeHours * 60 * 60 * 1000),
      source: "inline",
      fromCache: true
    };
  }

  const now = new Date();
  const cachedRate = await prisma.currencyRate.findFirst({
    where: {
      companyId,
      baseCurrency: normalizedBaseCurrency,
      quoteCurrency: normalizedQuoteCurrency
    },
    orderBy: {
      fetchedAt: "desc"
    }
  });

  if (cachedRate && cachedRate.expiresAt > now) {
    return {
      rate: cachedRate.rate,
      fetchedAt: cachedRate.fetchedAt,
      expiresAt: cachedRate.expiresAt,
      source: cachedRate.source,
      fromCache: true
    };
  }

  try {
    const response = await fetch(buildProviderUrl(normalizedBaseCurrency));

    if (!response.ok) {
      throw new AppError(502, "EXCHANGE_RATE_PROVIDER_FAILED", "Currency provider could not be reached");
    }

    const payload = (await response.json()) as ExchangeRateProviderPayload;
    const rateValue = payload.rates?.[normalizedQuoteCurrency];

    if (typeof rateValue !== "number" || Number.isNaN(rateValue) || rateValue <= 0) {
      throw new AppError(502, "EXCHANGE_RATE_NOT_FOUND", "Unable to resolve the selected currency conversion");
    }

    const expiresAt = new Date(now.getTime() + env.currencyRateCacheMaxAgeHours * 60 * 60 * 1000);
    const createdRate = await prisma.currencyRate.create({
      data: {
        companyId,
        baseCurrency: normalizedBaseCurrency,
        quoteCurrency: normalizedQuoteCurrency,
        rate: new Prisma.Decimal(rateValue),
        source: "exchange-rate-api",
        fetchedAt: now,
        expiresAt
      }
    });

    return {
      rate: createdRate.rate,
      fetchedAt: createdRate.fetchedAt,
      expiresAt: createdRate.expiresAt,
      source: createdRate.source,
      fromCache: false
    };
  } catch (error) {
    if (cachedRate) {
      return {
        rate: cachedRate.rate,
        fetchedAt: cachedRate.fetchedAt,
        expiresAt: cachedRate.expiresAt,
        source: `${cachedRate.source}-stale-fallback`,
        fromCache: true
      };
    }

    throw error;
  }
}
