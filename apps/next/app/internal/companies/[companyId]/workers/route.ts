import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { DocumentType, PayRateType, RoleApplicationStatus } from "@/db/enums";
import {
  companyAdministrators,
  companyContractors,
  companyRoleApplications,
  companyRoles,
  contractorProfiles,
  documents,
  users,
} from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { findCompany } from "../invoices/helpers";

const workerSchema = z.object({
  contractor: z.object({
    email: z.string().email(),
    started_at: z.string(),
    pay_rate_type: z.enum(["hourly", "project_based", "salary"]),
    pay_rate_in_subunits: z.number(),
    role_id: z.string(),
    on_trial: z.boolean().optional(),
    hours_per_week: z.number().optional(),
  }),
  application_id: z.union([z.string(), z.number()]).optional(),
});

const mapPayRateType = (type: "hourly" | "project_based" | "salary"): PayRateType => {
  if (type === "hourly") return PayRateType.Hourly;
  if (type === "project_based") return PayRateType.ProjectBased;
  return PayRateType.Salary;
};

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

  const body: unknown = await req.json().catch(() => ({}));
  const parseResult = workerSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ success: false, error: "Invalid parameters" }, { status: 422 });
  }

  const { contractor: contractorData, application_id } = parseResult.data;

  const role = await db.query.companyRoles.findFirst({
    where: and(eq(companyRoles.companyId, company.id), eq(companyRoles.externalId, contractorData.role_id)),
  });
  if (!role) {
    return NextResponse.json({ success: false, error_message: "Role not found" }, { status: 422 });
  }

  let user = await db.query.users.findFirst({
    where: eq(users.email, contractorData.email.toLowerCase()),
  });

  if (user) {
    const existingContractor = await db.query.companyContractors.findFirst({
      where: and(
        eq(companyContractors.companyId, company.id),
        eq(companyContractors.userId, user.id),
        isNull(companyContractors.endedAt),
      ),
    });
    if (existingContractor) {
      return NextResponse.json(
        { success: false, error_message: "Invitee is already working for this company." },
        { status: 422 },
      );
    }
  } else {
    const [newUser] = await db
      .insert(users)
      .values({
        email: contractorData.email.toLowerCase(),
      })
      .returning();
    if (!newUser) {
      return NextResponse.json({ success: false, error_message: "Failed to create user" }, { status: 500 });
    }
    user = newUser;
  }

  const startedAtDate = new Date(contractorData.started_at);
  const payRateTypeEnum = mapPayRateType(contractorData.pay_rate_type);

  const existingCompanyContractor = await db.query.companyContractors.findFirst({
    where: and(eq(companyContractors.companyId, company.id), eq(companyContractors.userId, user.id)),
  });

  let contractorRecordId: bigint;

  if (existingCompanyContractor) {
    const [updated] = await db
      .update(companyContractors)
      .set({
        companyRoleId: role.id,
        startedAt: startedAtDate,
        payRateType: payRateTypeEnum,
        payRateInSubunits: contractorData.pay_rate_in_subunits,
        hoursPerWeek: contractorData.hours_per_week ?? null,
        onTrial: contractorData.on_trial ?? false,
        endedAt: null,
      })
      .where(eq(companyContractors.id, existingCompanyContractor.id))
      .returning();
    if (!updated) {
      return NextResponse.json({ success: false, error_message: "Failed to update contractor" }, { status: 500 });
    }
    contractorRecordId = updated.id;
  } else {
    const [created] = await db
      .insert(companyContractors)
      .values({
        companyId: company.id,
        userId: user.id,
        companyRoleId: role.id,
        startedAt: startedAtDate,
        payRateType: payRateTypeEnum,
        payRateInSubunits: contractorData.pay_rate_in_subunits,
        hoursPerWeek: contractorData.hours_per_week ?? null,
        onTrial: contractorData.on_trial ?? false,
      })
      .returning();
    if (!created) {
      return NextResponse.json({ success: false, error_message: "Failed to create contractor" }, { status: 500 });
    }
    contractorRecordId = created.id;
  }

  const existingProfile = await db.query.contractorProfiles.findFirst({
    where: eq(contractorProfiles.userId, user.id),
  });
  if (!existingProfile) {
    await db.insert(contractorProfiles).values({
      userId: user.id,
      availableHoursPerWeek: 1,
    });
  }

  const today = new Date();
  await db.insert(documents).values({
    name: "Consulting Contract",
    type: DocumentType.ConsultingContract,
    year: today.getFullYear(),
    userId: user.id,
    companyContractorId: contractorRecordId,
    companyAdministratorId: admin.id,
    companyId: company.id,
  });

  if (application_id) {
    await db
      .update(companyRoleApplications)
      .set({ status: RoleApplicationStatus.Accepted })
      .where(eq(companyRoleApplications.id, BigInt(application_id)));
  }

  return NextResponse.json({ success: true, new_user_id: Number(user.id) });
}
