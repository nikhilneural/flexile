import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { DocumentType, PayRateType } from "@/db/enums";
import {
  companies,
  companyAdministrators,
  companyContractors,
  companyRoleRates,
  companyRoles,
  contractorProfiles,
  documents,
  users,
} from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";

const inviteSchema = z.object({
  company_administrator: z.object({ email: z.string().email() }),
  company: z.object({ name: z.string() }),
  company_role: z.object({ name: z.string() }),
  company_role_rate: z.object({
    pay_rate_in_subunits: z.number(),
    pay_rate_type: z.union([z.number(), z.enum(["hourly", "project_based", "salary"])]),
  }),
  company_worker: z.object({
    started_at: z.string(),
    pay_rate_in_subunits: z.number(),
    pay_rate_type: z.union([z.number(), z.enum(["hourly", "project_based", "salary"])]),
    hours_per_week: z.number().optional(),
  }),
});

const parsePayRateType = (val: number | "hourly" | "project_based" | "salary"): PayRateType => {
  if (val === 1 || val === "project_based") return PayRateType.ProjectBased;
  if (val === 2 || val === "salary") return PayRateType.Salary;
  return PayRateType.Hourly;
};

export async function POST(req: Request) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const workerUser = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
  });
  if (!workerUser) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  const body: unknown = await req.json().catch(() => ({}));
  const parseResult = inviteSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({ success: false, errors: { form: "Invalid parameters" } }, { status: 422 });
  }

  const {
    company_administrator: adminData,
    company: companyData,
    company_role: roleData,
    company_role_rate: rateData,
    company_worker: workerData,
  } = parseResult.data;

  const adminEmail = adminData.email.trim().toLowerCase();

  const existingAdminUser = await db.query.users.findFirst({
    where: eq(users.email, adminEmail),
  });

  if (existingAdminUser) {
    return NextResponse.json(
      {
        success: false,
        errors: {
          "user.email":
            "The email is already associated with a Flexile account. Please ask them to invite you as a contractor instead.",
        },
      },
      { status: 422 },
    );
  }

  const rolePayRateType = parsePayRateType(rateData.pay_rate_type);
  const workerPayRateType = parsePayRateType(workerData.pay_rate_type);
  const startedAtDate = new Date(workerData.started_at);

  const result = await db.transaction(async (tx) => {
    const [adminUser] = await tx
      .insert(users)
      .values({
        email: adminEmail,
      })
      .returning();
    if (!adminUser) throw new Error("Failed to create administrator user");

    const [company] = await tx
      .insert(companies)
      .values({
        name: companyData.name,
        email: adminEmail,
        countryCode: "US",
        defaultCurrency: "usd",
      })
      .returning();
    if (!company) throw new Error("Failed to create company");

    const [companyAdmin] = await tx
      .insert(companyAdministrators)
      .values({
        companyId: company.id,
        userId: adminUser.id,
      })
      .returning();
    if (!companyAdmin) throw new Error("Failed to create company administrator");

    const [role] = await tx
      .insert(companyRoles)
      .values({
        companyId: company.id,
        name: roleData.name,
        jobDescription: roleData.name,
      })
      .returning();
    if (!role) throw new Error("Failed to create company role");

    await tx.insert(companyRoleRates).values({
      companyRoleId: role.id,
      payRateType: rolePayRateType,
      payRateInSubunits: rateData.pay_rate_in_subunits,
      trialPayRateInSubunits: rateData.pay_rate_in_subunits,
      payRateCurrency: "usd",
    });

    const [contractor] = await tx
      .insert(companyContractors)
      .values({
        companyId: company.id,
        userId: workerUser.id,
        companyRoleId: role.id,
        startedAt: startedAtDate,
        payRateType: workerPayRateType,
        payRateInSubunits: workerData.pay_rate_in_subunits,
        hoursPerWeek: workerData.hours_per_week ?? null,
      })
      .returning();
    if (!contractor) throw new Error("Failed to create company contractor");

    const existingProfile = await tx.query.contractorProfiles.findFirst({
      where: eq(contractorProfiles.userId, workerUser.id),
    });
    if (!existingProfile) {
      await tx.insert(contractorProfiles).values({
        userId: workerUser.id,
        availableHoursPerWeek: 1,
      });
    }

    const today = new Date();
    await tx.insert(documents).values({
      name: "Consulting Contract",
      type: DocumentType.ConsultingContract,
      year: today.getFullYear(),
      userId: workerUser.id,
      companyContractorId: contractor.id,
      companyAdministratorId: companyAdmin.id,
      companyId: company.id,
    });

    return { adminUser, companyAdmin };
  });

  return NextResponse.json(
    {
      success: true,
      new_user_id: Number(result.adminUser.id),
      administrator_id: Number(result.companyAdmin.id),
    },
    { status: 201 },
  );
}
