import { formatISO, subMonths, subQuarters, subYears } from "date-fns";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { companyContractors, companyInvestors, type companyUpdates } from "@/db/schema";

type UpdateRecord = typeof companyUpdates.$inferSelect;

export function getYoutubeVideoId(videoUrl: string | null | undefined): string | null {
  if (!videoUrl) return null;
  const match = /(?:youtube\.com.*[?&]v=|youtu\.be\/)([\w-]+)/u.exec(videoUrl);
  return match?.[1] ?? null;
}

export function formatPeriodLabel(date: Date, period: "month" | "quarter" | "year"): string {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  if (period === "month") {
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  }
  if (period === "quarter") {
    const q = Math.floor(date.getMonth() / 3) + 1;
    return `Q${q} ${date.getFullYear()}`;
  }
  return date.getFullYear().toString();
}

export async function getRecipientCounts(companyId: bigint) {
  const activeContractors = await db.query.companyContractors.findMany({
    where: and(eq(companyContractors.companyId, companyId), isNull(companyContractors.endedAt)),
    columns: { userId: true },
  });
  const contractorUserIds = new Set(activeContractors.map((c) => c.userId));

  const allInvestors = await db.query.companyInvestors.findMany({
    where: eq(companyInvestors.companyId, companyId),
    columns: { userId: true },
  });
  const exclusiveInvestors = allInvestors.filter((inv) => !contractorUserIds.has(inv.userId));

  return {
    contractors: activeContractors.length,
    investors: exclusiveInvestors.length,
  };
}

export function getFinancialPeriods() {
  const now = new Date();

  const lastMonth = subMonths(now, 1);
  const startOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);

  const lastQuarter = subQuarters(now, 1);
  const startOfLastQuarter = new Date(lastQuarter.getFullYear(), Math.floor(lastQuarter.getMonth() / 3) * 3, 1);

  const lastYear = subYears(now, 1);
  const startOfLastYear = new Date(lastYear.getFullYear(), 0, 1);

  return [
    {
      label: `${formatPeriodLabel(startOfLastMonth, "month")} (Last month)`,
      period: "month" as const,
      period_started_on: formatISO(startOfLastMonth, { representation: "date" }),
    },
    {
      label: `${formatPeriodLabel(startOfLastQuarter, "quarter")} (Last quarter)`,
      period: "quarter" as const,
      period_started_on: formatISO(startOfLastQuarter, { representation: "date" }),
    },
    {
      label: `${formatPeriodLabel(startOfLastYear, "year")} (Last year)`,
      period: "year" as const,
      period_started_on: formatISO(startOfLastYear, { representation: "date" }),
    },
  ];
}

export function presentCompanyUpdate(update: UpdateRecord, primaryAdminName = "Administrator") {
  const periodLabel =
    update.period && update.periodStartedOn ? formatPeriodLabel(new Date(update.periodStartedOn), update.period) : null;

  return {
    id: update.externalId,
    title: update.title,
    period_label: periodLabel,
    sender_name: primaryAdminName,
    body: update.body,
    video_url: update.videoUrl,
    youtube_video_id: getYoutubeVideoId(update.videoUrl),
    status: update.sentAt ? "Sent" : "Draft",
    sent_at: update.sentAt,
    period: update.period,
    period_started_on: update.periodStartedOn,
    show_revenue: update.showRevenue,
    show_net_income: update.showNetIncome,
  };
}
