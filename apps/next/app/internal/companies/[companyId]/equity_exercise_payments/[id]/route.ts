import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { companyAdministrators, equityGrantExerciseRequests, equityGrantExercises, equityGrants } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../../invoices/helpers";

export async function PATCH(req: Request, { params }: { params: Promise<{ companyId: string; id: string }> }) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { companyId, id } = await params;
  const company = await findCompany(companyId);
  if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

  const admin = await db.query.companyAdministrators.findFirst({
    where: and(eq(companyAdministrators.companyId, company.id), eq(companyAdministrators.userId, BigInt(userId))),
  });
  if (!admin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const exercise = await db.query.equityGrantExercises.findFirst({
    where: and(eq(equityGrantExercises.id, BigInt(id)), eq(equityGrantExercises.companyId, company.id)),
  });
  if (!exercise) return NextResponse.json({ success: false, error: "Exercise not found" }, { status: 404 });

  const requests = await db.query.equityGrantExerciseRequests.findMany({
    where: eq(equityGrantExerciseRequests.equityGrantExerciseId, exercise.id),
  });

  await db.transaction(async (tx) => {
    await tx.update(equityGrantExercises).set({ status: "completed" }).where(eq(equityGrantExercises.id, exercise.id));

    for (const request of requests) {
      const grant = await tx.query.equityGrants.findFirst({
        where: eq(equityGrants.id, request.equityGrantId),
      });
      if (grant) {
        await tx
          .update(equityGrants)
          .set({
            vestedShares: grant.vestedShares - request.numberOfOptions,
            exercisedShares: grant.exercisedShares + request.numberOfOptions,
            activeExerciseId: null,
          })
          .where(eq(equityGrants.id, grant.id));
      }
    }
  });

  return NextResponse.json({ success: true });
}

export async function PUT(req: Request, props: { params: Promise<{ companyId: string; id: string }> }) {
  return PATCH(req, props);
}
