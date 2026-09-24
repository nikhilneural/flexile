import { formatISO } from "date-fns";
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { DocumentType } from "@/db/enums";
import {
  companyAdministrators,
  companyContractors,
  companyInvestors,
  documents,
  equityGrants,
  optionPools,
  vestingSchedules,
} from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../../invoices/helpers";

const createGrantSchema = z.object({
  equity_grant: z.object({
    company_worker_id: z.string(),
    option_pool_id: z.string(),
    number_of_shares: z.number(),
    issue_date_relationship: z
      .enum(["employee", "consultant", "investor", "founder", "officer", "executive", "board_member"])
      .optional(),
    option_grant_type: z.enum(["nso", "iso"]).optional(),
    option_expiry_months: z.number().optional(),
    vesting_trigger: z.enum(["scheduled", "invoice_paid"]).optional(),
    voluntary_termination_exercise_months: z.number().optional(),
    involuntary_termination_exercise_months: z.number().optional(),
    termination_with_cause_exercise_months: z.number().optional(),
    death_exercise_months: z.number().optional(),
    disability_exercise_months: z.number().optional(),
    retirement_exercise_months: z.number().optional(),
    board_approval_date: z.string().optional(),
    vesting_commencement_date: z.string().optional(),
    vesting_schedule_id: z.string().optional(),
    total_vesting_duration_months: z.number().optional(),
    cliff_duration_months: z.number().optional(),
    vesting_frequency_months: z.number().optional(),
  }),
});

export async function POST(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const admin = await db.query.companyAdministrators.findFirst({
    where: and(eq(companyAdministrators.companyId, company.id), eq(companyAdministrators.userId, BigInt(userId))),
  });
  if (!admin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const rawBody: unknown = await req.json().catch(() => ({}));
  const parseResult = createGrantSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 422 });
  }

  const { equity_grant: data } = parseResult.data;

  const worker = await db.query.companyContractors.findFirst({
    where: and(eq(companyContractors.externalId, data.company_worker_id), eq(companyContractors.companyId, company.id)),
    with: { user: true },
  });
  if (!worker) return NextResponse.json({ success: false, error: "Worker not found" }, { status: 404 });

  const pool = await db.query.optionPools.findFirst({
    where: and(eq(optionPools.externalId, data.option_pool_id), eq(optionPools.companyId, company.id)),
  });
  if (!pool) return NextResponse.json({ success: false, error: "Option pool not found" }, { status: 404 });

  let investor = await db.query.companyInvestors.findFirst({
    where: and(eq(companyInvestors.companyId, company.id), eq(companyInvestors.userId, worker.userId)),
  });

  if (!investor) {
    const [newInvestor] = await db
      .insert(companyInvestors)
      .values({
        companyId: company.id,
        userId: worker.userId,
        investmentAmountInCents: 0n,
      })
      .returning();
    if (!newInvestor) return NextResponse.json({ success: false, error: "Failed to create investor" }, { status: 500 });
    investor = newInvestor;
  }

  let vestingScheduleId: bigint | null = null;
  if (data.vesting_schedule_id) {
    const vs = await db.query.vestingSchedules.findFirst({
      where: eq(vestingSchedules.externalId, data.vesting_schedule_id),
    });
    if (vs) vestingScheduleId = vs.id;
  }

  const today = new Date();
  const expiryMonths = data.option_expiry_months ?? 120;
  const expiresAt = new Date(today.getTime() + expiryMonths * 30 * 24 * 60 * 60 * 1000);
  const boardApprovalDate = data.board_approval_date || formatISO(today, { representation: "date" });

  const result = await db.transaction(async (tx) => {
    const [grant] = await tx
      .insert(equityGrants)
      .values({
        name: `${pool.name} Grant`,
        companyInvestorId: investor.id,
        optionPoolId: pool.id,
        numberOfShares: data.number_of_shares,
        vestedShares: 0,
        unvestedShares: data.number_of_shares,
        exercisedShares: 0,
        forfeitedShares: 0,
        periodStartedAt: today,
        periodEndedAt: expiresAt,
        issuedAt: today,
        expiresAt,
        optionHolderName: worker.user.legalName || "Option Holder",
        sharePriceUsd: company.conversionSharePriceUsd || "1",
        exercisePriceUsd: company.fmvPerShareInUsd || "1",
        issueDateRelationship: data.issue_date_relationship || "consultant",
        optionGrantType: data.option_grant_type || "nso",
        boardApprovalDate,
        voluntaryTerminationExerciseMonths: data.voluntary_termination_exercise_months ?? 3,
        involuntaryTerminationExerciseMonths: data.involuntary_termination_exercise_months ?? 3,
        terminationWithCauseExerciseMonths: data.termination_with_cause_exercise_months ?? 0,
        deathExerciseMonths: data.death_exercise_months ?? 12,
        disabilityExerciseMonths: data.disability_exercise_months ?? 12,
        retirementExerciseMonths: data.retirement_exercise_months ?? 3,
        vestingTrigger: data.vesting_trigger ?? "scheduled",
        ...(vestingScheduleId ? { vestingScheduleId } : {}),
      })
      .returning();

    if (!grant) throw new Error("Failed to insert equity grant");

    const primaryAdmin = await tx.query.companyAdministrators.findFirst({
      where: eq(companyAdministrators.companyId, company.id),
      orderBy: asc(companyAdministrators.id),
    });

    const [doc] = await tx
      .insert(documents)
      .values({
        name: `Equity Incentive Plan ${today.getFullYear()}`,
        type: DocumentType.EquityPlanContract,
        year: today.getFullYear(),
        userId: worker.userId,
        companyId: company.id,
        companyContractorId: worker.id,
        companyAdministratorId: primaryAdmin ? primaryAdmin.id : admin.id,
        equityGrantId: grant.id,
      })
      .returning();

    if (!doc) throw new Error("Failed to create document");

    return { grant, doc };
  });

  return NextResponse.json({ document_id: Number(result.doc.id) });
}
