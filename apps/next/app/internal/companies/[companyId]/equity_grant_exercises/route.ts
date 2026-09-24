import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { DocumentType } from "@/db/enums";
import {
  companyAdministrators,
  companyContractors,
  companyInvestors,
  documents,
  equityGrantExerciseRequests,
  equityGrantExercises,
  equityGrants,
} from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../invoices/helpers";

const exerciseSchema = z.object({
  submission_id: z.union([z.string(), z.number()]).optional(),
  equity_grants: z.array(
    z.object({
      id: z.string(),
      number_of_options: z.number(),
    }),
  ),
});

export async function POST(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const investor = await db.query.companyInvestors.findFirst({
    where: and(eq(companyInvestors.companyId, company.id), eq(companyInvestors.userId, BigInt(userId))),
  });
  if (!investor) return NextResponse.json({ success: false, error: "Investor not found" }, { status: 403 });

  const worker = await db.query.companyContractors.findFirst({
    where: and(eq(companyContractors.companyId, company.id), eq(companyContractors.userId, BigInt(userId))),
  });

  const body: unknown = await req.json().catch(() => ({}));
  const parseResult = exerciseSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ success: false, error: "Invalid exercise parameters" }, { status: 422 });
  }

  const { submission_id, equity_grants: grantInputs } = parseResult.data;
  const grantExternalIds = grantInputs.map((g) => g.id);

  const grants = await db.query.equityGrants.findMany({
    where: and(eq(equityGrants.companyInvestorId, investor.id), inArray(equityGrants.externalId, grantExternalIds)),
  });

  if (grants.length === 0) {
    return NextResponse.json({ success: false, error: "Grants not found" }, { status: 404 });
  }

  const optionsMap = new Map(grantInputs.map((g) => [g.id, g.number_of_options]));

  let totalOptions = 0;
  let totalCostCents = 0;

  for (const grant of grants) {
    const numOptions = optionsMap.get(grant.externalId) ?? 0;
    const price = Number(grant.exercisePriceUsd || 0);
    const cost = Math.round(price * numOptions * 100);
    totalOptions += numOptions;
    totalCostCents += cost;
  }

  const now = new Date();
  const grantNames = grants.map((g) => g.name).join(", ");

  const exercise = await db.transaction(async (tx) => {
    const [ex] = await tx
      .insert(equityGrantExercises)
      .values({
        companyId: company.id,
        companyInvestorId: investor.id,
        requestedAt: now,
        signedAt: now,
        numberOfOptions: BigInt(totalOptions),
        totalCostCents: BigInt(totalCostCents),
        status: "signed",
        bankReference: grantNames || "Exercise",
      })
      .returning();

    if (!ex) throw new Error("Failed to create exercise");

    for (const grant of grants) {
      const numOptions = optionsMap.get(grant.externalId) ?? 0;
      await tx.insert(equityGrantExerciseRequests).values({
        equityGrantId: grant.id,
        equityGrantExerciseId: ex.id,
        numberOfOptions: numOptions,
        exercisePriceUsd: grant.exercisePriceUsd,
      });

      await tx.update(equityGrants).set({ activeExerciseId: ex.id }).where(eq(equityGrants.id, grant.id));
    }

    const primaryAdmin = await tx.query.companyAdministrators.findFirst({
      where: eq(companyAdministrators.companyId, company.id),
      orderBy: asc(companyAdministrators.id),
    });

    await tx.insert(documents).values({
      name: "Notice of Exercise",
      type: DocumentType.ExerciseNotice,
      year: now.getFullYear(),
      companyId: company.id,
      userId: BigInt(userId),
      companyContractorId: worker?.id ?? null,
      companyAdministratorId: primaryAdmin ? primaryAdmin.id : null,
      docusealSubmissionId: submission_id != null ? Number(submission_id) : null,
      completedAt: now,
    });

    return ex;
  });

  return NextResponse.json({ id: Number(exercise.id) });
}
