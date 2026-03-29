import { CountryCurrencyCache } from "@prisma/client";

import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";

type RestCountryRecord = {
  cca2?: string;
  name?: {
    common?: string;
  };
  currencies?: Record<
    string,
    {
      name?: string;
      symbol?: string;
    }
  >;
};

export type CountryCurrencyOption = {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencyName: string | null;
  currencySymbol: string | null;
};

function mapCacheRecord(record: CountryCurrencyCache): CountryCurrencyOption {
  return {
    countryCode: record.countryCode,
    countryName: record.countryName,
    currencyCode: record.currencyCode,
    currencyName: record.currencyName,
    currencySymbol: record.currencySymbol
  };
}

function normalizeCountryRecords(payload: unknown): CountryCurrencyOption[] {
  if (!Array.isArray(payload)) {
    throw new AppError(502, "COUNTRY_PROVIDER_INVALID", "Country provider returned an invalid response");
  }

  return payload
    .map((entry) => entry as RestCountryRecord)
    .flatMap((entry) => {
      const countryCode = entry.cca2?.trim().toUpperCase();
      const countryName = entry.name?.common?.trim();
      const currencies = entry.currencies ? Object.entries(entry.currencies) : [];

      if (!countryCode || !countryName || currencies.length === 0) {
        return [];
      }

      const [currencyCode, currencyMeta] = currencies[0];

      return [
        {
          countryCode,
          countryName,
          currencyCode,
          currencyName: currencyMeta.name?.trim() ?? null,
          currencySymbol: currencyMeta.symbol?.trim() ?? null
        }
      ];
    })
    .sort((left, right) => left.countryName.localeCompare(right.countryName));
}

function isCacheStale(records: CountryCurrencyCache[]): boolean {
  if (records.length === 0) {
    return true;
  }

  const maxAgeMs = env.countryCacheMaxAgeHours * 60 * 60 * 1000;
  const now = Date.now();

  return records.some((record) => now - record.lastSyncedAt.getTime() > maxAgeMs);
}

async function refreshCountryCurrencyCache(): Promise<CountryCurrencyOption[]> {
  const response = await fetch(env.restCountriesUrl);

  if (!response.ok) {
    throw new AppError(502, "COUNTRY_PROVIDER_FAILED", "Unable to fetch country and currency data");
  }

  const payload = await response.json();
  const normalizedCountries = normalizeCountryRecords(payload);

  await prisma.$transaction(
    normalizedCountries.map((country) =>
      prisma.countryCurrencyCache.upsert({
        where: { countryCode: country.countryCode },
        update: {
          countryName: country.countryName,
          currencyCode: country.currencyCode,
          currencyName: country.currencyName,
          currencySymbol: country.currencySymbol,
          sourceName: "restcountries",
          lastSyncedAt: new Date()
        },
        create: {
          countryCode: country.countryCode,
          countryName: country.countryName,
          currencyCode: country.currencyCode,
          currencyName: country.currencyName,
          currencySymbol: country.currencySymbol,
          sourceName: "restcountries"
        }
      })
    )
  );

  return normalizedCountries;
}

export async function listCountryCurrencyOptions(forceRefresh = false): Promise<CountryCurrencyOption[]> {
  const cachedRecords = await prisma.countryCurrencyCache.findMany({
    orderBy: { countryName: "asc" }
  });

  const shouldRefresh = forceRefresh || isCacheStale(cachedRecords);

  if (!shouldRefresh) {
    return cachedRecords.map(mapCacheRecord);
  }

  try {
    return await refreshCountryCurrencyCache();
  } catch (error) {
    if (cachedRecords.length > 0) {
      return cachedRecords.map(mapCacheRecord);
    }

    throw error;
  }
}

export async function resolveCountryCurrency(countryCode: string): Promise<CountryCurrencyOption> {
  const normalizedCode = countryCode.trim().toUpperCase();

  const cachedRecord = await prisma.countryCurrencyCache.findUnique({
    where: { countryCode: normalizedCode }
  });

  if (cachedRecord) {
    return mapCacheRecord(cachedRecord);
  }

  const options = await listCountryCurrencyOptions(true);
  const matchedCountry = options.find((option) => option.countryCode === normalizedCode);

  if (!matchedCountry) {
    throw new AppError(400, "COUNTRY_NOT_SUPPORTED", "Select a valid country");
  }

  return matchedCountry;
}
