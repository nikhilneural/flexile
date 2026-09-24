import countriesData from "@/config/countries.json";

export interface CountryInfo {
  countryName: string;
  supportsWisePayout: boolean;
  sanctioned: boolean;
  hasTaxTreaty: boolean;
}

export const countries: Record<string, CountryInfo> = countriesData;

export const isSanctionedCountry = (countryCode: string | null | undefined): boolean => {
  if (!countryCode) return false;
  return !!countries[countryCode]?.sanctioned;
};

export const isRestrictedPayoutCountry = (countryCode: string | null | undefined): boolean => {
  if (!countryCode) return false;
  return !countries[countryCode]?.supportsWisePayout;
};

export const getCountryName = (countryCode: string | null | undefined): string | null => {
  if (!countryCode) return null;
  return countries[countryCode]?.countryName ?? null;
};
