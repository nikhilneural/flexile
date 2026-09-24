import { iso31662 } from "iso-3166";
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

export const getCountryStates = (countryCode: string | null | undefined): [string, string][] => {
  if (!countryCode) return [];
  return iso31662
    .filter((s) => s.parent === countryCode)
    .map((s) => [s.name, s.code.replace(`${countryCode}-`, "")] as [string, string])
    .sort((a, b) => a[0].localeCompare(b[0]));
};
