import { utc } from "@date-fns/utc";
import { format } from "date-fns";

export type Period = {
  startsOn: string | null;
  endsOn: string | null;
};

export const areOverlapping = <T extends Period>(period1: T, period2: T): boolean => {
  if (!period1.startsOn || !period2.startsOn || !period1.endsOn || !period2.endsOn) return false;

  return (
    (period1.startsOn <= period2.endsOn && period1.endsOn >= period2.startsOn) ||
    (period2.startsOn <= period1.endsOn && period2.endsOn >= period1.startsOn)
  );
};
export const formatDateRange = (
  period: Period,
  options: { includeWeekday?: boolean } = { includeWeekday: false },
): string => {
  const currentYear = new Date().getFullYear();
  const startDate = period.startsOn ? utc(period.startsOn) : null;
  const endDate = period.endsOn ? utc(period.endsOn) : null;

  const formatString = options.includeWeekday ? "EEE, MMM d" : "MMM d";

  // Examples of formatted date ranges:
  // - Same month, current year: "Jun 1 - 15"
  // - Different months, current year: "Jun 29 - Jul 5"
  // - Spanning two years: "Dec 29, 2023 - Jan 4"
  // - Last year: "Jun 1 - 15, 2023"
  // - Same day for start and end dates: "Jun 1" or "Jun 1, 2023"
  // - Missing start or end date: "Jun 1" or "Jun 1, 2023"
  // - Including weekday: "Tue, Jun 1 - Fri, Jun 4"
  if (startDate && !endDate) {
    return format(startDate, startDate.getFullYear() !== currentYear ? `${formatString}, yyyy` : formatString);
  }

  if (!startDate && endDate) {
    return format(endDate, endDate.getFullYear() !== currentYear ? `${formatString}, yyyy` : formatString);
  }

  if (!startDate || !endDate) return "";

  if (startDate.getTime() === endDate.getTime()) {
    return format(startDate, startDate.getFullYear() !== currentYear ? `${formatString}, yyyy` : formatString);
  }

  const startFormatted = format(
    startDate,
    startDate.getFullYear() !== endDate.getFullYear() ? `${formatString}, yyyy` : formatString,
  );
  const endFormatted = format(
    endDate,
    startDate.getMonth() !== endDate.getMonth() || options.includeWeekday
      ? endDate.getFullYear() !== currentYear
        ? `${formatString}, yyyy`
        : formatString
      : endDate.getFullYear() !== currentYear
        ? "d, yyyy"
        : "d",
  );

  return `${startFormatted} - ${endFormatted}`;
};
