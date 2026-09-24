import { and, asc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { BusinessType, DocumentType, TaxClassification } from "@/db/enums";
import { companyAdministrators, companyContractors, documents, userComplianceInfos, users } from "@/db/schema";
import { resolveClerkUserId } from "@/trpc/auth";
import { latestUserComplianceInfo, userDisplayName } from "@/trpc/routes/users/helpers";

const CONSULTING_CONTRACT_ATTRIBUTES = [
  "legal_name",
  "business_entity",
  "business_name",
  "street_address",
  "city",
  "state",
  "zip_code",
  "country_code",
  "citizenship_country_code",
] as const;

export async function GET(req: Request) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
    with: {
      userComplianceInfos: latestUserComplianceInfo,
      companyContractors: {
        with: { company: true },
        where: isNull(companyContractors.endedAt),
      },
    },
  });

  if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  const compliance = user.userComplianceInfos[0];
  const citizenshipCountryCode = compliance?.citizenshipCountryCode ?? user.citizenshipCountryCode ?? "US";
  const countryCode = compliance?.countryCode ?? user.countryCode ?? "US";
  const requiresW9 = [citizenshipCountryCode, countryCode].includes("US");
  const isForeign = !requiresW9;

  const taxIdStatus =
    compliance?.taxIdStatus === "verified" || compliance?.taxIdStatus === "invalid" ? compliance.taxIdStatus : null;

  const contractorForCompanies = user.companyContractors.map((c) => c.company.name || "Company");

  return NextResponse.json({
    birth_date: compliance?.birthDate ?? user.birthDate ?? null,
    business_name: compliance?.businessName ?? null,
    business_type: compliance?.businessType != null ? Number(compliance.businessType) : null,
    tax_classification: compliance?.taxClassification != null ? Number(compliance.taxClassification) : null,
    citizenship_country_code: citizenshipCountryCode,
    city: compliance?.city ?? user.city ?? "",
    country_code: countryCode,
    display_name: userDisplayName(user),
    business_entity: Boolean(compliance?.businessEntity ?? false),
    is_foreign: isForeign,
    is_tax_information_confirmed: Boolean(compliance?.taxInformationConfirmedAt),
    legal_name: compliance?.legalName ?? user.legalName ?? "",
    signature: compliance?.signature ?? "",
    state: compliance?.state ?? user.state ?? "",
    street_address: compliance?.streetAddress ?? user.streetAddress ?? "",
    tax_id: compliance?.taxId ?? null,
    tax_id_status: taxIdStatus,
    zip_code: compliance?.zipCode ?? user.zipCode ?? "",
    contractor_for_companies: contractorForCompanies,
  });
}

const inputSchema = z.object({
  legal_name: z.string().optional(),
  country_code: z.string().optional(),
  citizenship_country_code: z.string().optional(),
  street_address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  birth_date: z.union([z.string(), z.date()]).optional(),
  business_entity: z.boolean().optional(),
  business_name: z.string().nullable().optional(),
  business_type: z.nativeEnum(BusinessType).nullable().optional(),
  tax_classification: z.nativeEnum(TaxClassification).nullable().optional(),
  tax_id: z.string().nullable().optional(),
  signature: z.string().optional(),
});

export async function PATCH(req: Request) {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const rawBody: unknown = await req.json().catch(() => ({}));
  const bodyObj = typeof rawBody === "object" && rawBody !== null ? rawBody : {};
  const dataObj =
    "data" in bodyObj && typeof bodyObj.data === "object" && bodyObj.data !== null
      ? bodyObj.data
      : "user" in bodyObj && typeof bodyObj.user === "object" && bodyObj.user !== null
        ? bodyObj.user
        : bodyObj;
  const parseResult = inputSchema.safeParse(dataObj);
  const data = parseResult.success ? parseResult.data : {};

  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
    with: {
      userComplianceInfos: latestUserComplianceInfo,
      companyContractors: {
        where: isNull(companyContractors.endedAt),
        with: { company: true },
      },
    },
  });

  if (!user) return NextResponse.json({ error_message: "User not found" }, { status: 404 });

  const prevCompliance = user.userComplianceInfos[0];

  const legalName =
    typeof data.legal_name === "string" ? data.legal_name.trim() : (prevCompliance?.legalName ?? user.legalName);
  const countryCode =
    typeof data.country_code === "string"
      ? data.country_code.trim()
      : (prevCompliance?.countryCode ?? user.countryCode ?? "US");
  const citizenshipCountryCode =
    typeof data.citizenship_country_code === "string"
      ? data.citizenship_country_code.trim()
      : (prevCompliance?.citizenshipCountryCode ?? user.citizenshipCountryCode ?? "US");
  const streetAddress =
    typeof data.street_address === "string"
      ? data.street_address.trim()
      : (prevCompliance?.streetAddress ?? user.streetAddress ?? "");
  const city = typeof data.city === "string" ? data.city.trim() : (prevCompliance?.city ?? user.city ?? "");
  const state = typeof data.state === "string" ? data.state.trim() : (prevCompliance?.state ?? user.state ?? "");
  const zipCode =
    typeof data.zip_code === "string" ? data.zip_code.trim() : (prevCompliance?.zipCode ?? user.zipCode ?? "");
  const birthDate = data.birth_date ? String(data.birth_date).trim() : (prevCompliance?.birthDate ?? user.birthDate);
  const businessEntity =
    data.business_entity !== undefined
      ? Boolean(data.business_entity)
      : Boolean(prevCompliance?.businessEntity ?? false);
  const businessName =
    typeof data.business_name === "string" ? data.business_name.trim() : (prevCompliance?.businessName ?? null);
  const businessType = data.business_type !== undefined ? data.business_type : (prevCompliance?.businessType ?? null);
  const taxClassification =
    data.tax_classification !== undefined ? data.tax_classification : (prevCompliance?.taxClassification ?? null);
  const taxId =
    typeof data.tax_id === "string" && data.tax_id.trim() ? data.tax_id.trim() : (prevCompliance?.taxId ?? null);
  const signature = typeof data.signature === "string" ? data.signature.trim() : (prevCompliance?.signature ?? null);

  // Determine if consulting contract should be regenerated
  const changedMap: Record<string, boolean> = {
    legal_name: Boolean(data.legal_name && data.legal_name !== (prevCompliance?.legalName ?? user.legalName)),
    business_entity: Boolean(
      data.business_entity !== undefined &&
        Boolean(data.business_entity) !== Boolean(prevCompliance?.businessEntity ?? false),
    ),
    business_name: Boolean(data.business_name && data.business_name !== prevCompliance?.businessName),
    street_address: Boolean(
      data.street_address && data.street_address !== (prevCompliance?.streetAddress ?? user.streetAddress),
    ),
    city: Boolean(data.city && data.city !== (prevCompliance?.city ?? user.city)),
    state: Boolean(data.state && data.state !== (prevCompliance?.state ?? user.state)),
    zip_code: Boolean(data.zip_code && data.zip_code !== (prevCompliance?.zipCode ?? user.zipCode)),
    country_code: Boolean(data.country_code && data.country_code !== (prevCompliance?.countryCode ?? user.countryCode)),
    citizenship_country_code: Boolean(
      data.citizenship_country_code &&
        data.citizenship_country_code !== (prevCompliance?.citizenshipCountryCode ?? user.citizenshipCountryCode),
    ),
  };

  const shouldRegenerate =
    CONSULTING_CONTRACT_ATTRIBUTES.some((attr) => changedMap[attr]) && user.companyContractors.length > 0;

  const createdDocumentIds: number[] = [];

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        legalName: legalName ?? undefined,
        countryCode: countryCode ?? undefined,
        citizenshipCountryCode: citizenshipCountryCode ?? undefined,
        streetAddress: streetAddress || undefined,
        city: city || undefined,
        state: state || undefined,
        zipCode: zipCode || undefined,
        birthDate: birthDate ?? undefined,
      })
      .where(eq(users.id, user.id));

    const [newCompliance] = await tx
      .insert(userComplianceInfos)
      .values({
        userId: user.id,
        legalName,
        countryCode,
        citizenshipCountryCode,
        streetAddress,
        city,
        state,
        zipCode,
        birthDate,
        businessEntity,
        businessName,
        businessType,
        taxClassification,
        taxId,
        signature,
        taxInformationConfirmedAt: new Date(),
        taxIdStatus: null,
      })
      .returning();

    if (shouldRegenerate && newCompliance) {
      for (const contractor of user.companyContractors) {
        const primaryAdmin = await tx.query.companyAdministrators.findFirst({
          where: eq(companyAdministrators.companyId, contractor.companyId),
          orderBy: asc(companyAdministrators.id),
        });

        // Mark uncompleted consulting contracts deleted
        await tx
          .update(documents)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(documents.companyContractorId, contractor.id),
              isNull(documents.completedAt),
              isNull(documents.deletedAt),
            ),
          );

        // Create new consulting contract
        const [doc] = await tx
          .insert(documents)
          .values({
            name: "Consulting agreement",
            type: DocumentType.ConsultingContract,
            year: new Date().getFullYear(),
            userId: user.id,
            companyId: contractor.companyId,
            companyContractorId: contractor.id,
            companyAdministratorId: primaryAdmin ? primaryAdmin.id : null,
            userComplianceInfoId: newCompliance.id,
          })
          .returning();

        if (doc) {
          createdDocumentIds.push(Number(doc.id));
        }
      }
    }
  });

  return NextResponse.json({ documentIds: createdDocumentIds });
}
