import "server-only";
import { and, asc, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import { cookies as getCookies } from "next/headers";
import { db } from "@/db";
import { DocumentType } from "@/db/enums";
import {
  companies,
  companyAdministrators,
  companyContractors,
  companyInvestors,
  companyStripeAccounts,
  convertibleSecurities,
  documents,
  equityGrants,
  shareHoldings,
  users,
  wiseRecipients,
} from "@/db/schema";
import { type CurrentUser, currentUserSchema } from "@/models/user";
import { resolveClerkUserId } from "@/trpc/auth";
import { getCountryName, isSanctionedCountry } from "@/utils/countries";
import { latestUserComplianceInfo, userDisplayEmail, userDisplayName } from "./helpers";

type AccessRole = "administrator" | "worker" | "lawyer" | "investor";

export interface CurrentUserDataOptions {
  host?: string | null;
  selectedCompanyId?: string | null;
  accessRoles?: Record<string, AccessRole>;
}

export async function getCurrentUserData(
  userId: number | bigint,
  options: CurrentUserDataOptions = {},
): Promise<CurrentUser | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, BigInt(userId)),
    with: {
      userComplianceInfos: latestUserComplianceInfo,
      companyAdministrators: {
        with: { company: true },
      },
      companyContractors: {
        with: { company: true, role: true },
      },
      companyInvestors: {
        with: { company: true },
      },
      companyLawyers: {
        with: { company: true },
      },
      wiseRecipients: {
        where: and(eq(wiseRecipients.usedForInvoices, true), isNull(wiseRecipients.deletedAt)),
      },
    },
  });

  if (!user) return null;

  const complianceInfo = user.userComplianceInfos[0];
  const isBusinessEntity = !!complianceInfo?.businessEntity;
  const businessName = complianceInfo?.businessName ?? null;
  const billingEntityName = isBusinessEntity ? businessName : user.legalName;

  // Documents check: documents not consulting_contract or completed_at is not null
  const hasDocuments =
    (await db.query.documents.findFirst({
      where: and(
        eq(documents.userId, user.id),
        or(ne(documents.type, DocumentType.ConsultingContract), isNotNull(documents.completedAt)),
      ),
    })) != null;

  // Collect all unique companies
  const companyMap = new Map<bigint, typeof companies.$inferSelect>();
  for (const admin of user.companyAdministrators) {
    if (admin.company) companyMap.set(admin.company.id, admin.company);
  }
  for (const contractor of user.companyContractors) {
    if (contractor.company) companyMap.set(contractor.company.id, contractor.company);
  }
  for (const investor of user.companyInvestors) {
    if (investor.company) companyMap.set(investor.company.id, investor.company);
  }
  for (const lawyer of user.companyLawyers) {
    if (lawyer.company) companyMap.set(lawyer.company.id, lawyer.company);
  }

  const allCompaniesList = Array.from(companyMap.values());

  // Determine current company
  let selectedCompany = options.selectedCompanyId
    ? (allCompaniesList.find((c) => c.externalId === options.selectedCompanyId) ?? null)
    : null;

  if (!selectedCompany) {
    // Determine company_from_user
    if (user.companyContractors.length > 0 && user.companyContractors[0]?.company) {
      selectedCompany = user.companyContractors[0].company;
    } else if (
      user.companyAdministrators.length > 0 &&
      user.companyContractors.length === 0 &&
      user.companyInvestors.length === 0 &&
      user.companyAdministrators[0]?.company
    ) {
      selectedCompany = user.companyAdministrators[0].company;
    } else if (
      user.companyLawyers.length > 0 &&
      user.companyContractors.length === 0 &&
      user.companyInvestors.length === 0 &&
      user.companyLawyers[0]?.company
    ) {
      selectedCompany = user.companyLawyers[0].company;
    } else if (user.companyInvestors.length > 0 && user.companyInvestors[0]?.company) {
      selectedCompany = user.companyInvestors[0].company;
    }
  }

  // Pre-fetch Stripe accounts and active contractor/investor counts for all companies
  const stripeAccountsMap = new Map<bigint, typeof companyStripeAccounts.$inferSelect>();
  const primaryAdminMap = new Map<bigint, { name: string }>();
  const activeContractorCountMap = new Map<bigint, number>();
  const investorCountMap = new Map<bigint, number>();

  for (const company of allCompaniesList) {
    const stripeAccount = await db.query.companyStripeAccounts.findFirst({
      where: and(eq(companyStripeAccounts.companyId, company.id), isNull(companyStripeAccounts.deletedAt)),
      orderBy: [asc(companyStripeAccounts.id)],
    });
    if (stripeAccount) stripeAccountsMap.set(company.id, stripeAccount);

    const primaryAdmin = await db.query.companyAdministrators.findFirst({
      where: eq(companyAdministrators.companyId, company.id),
      orderBy: [asc(companyAdministrators.id)],
      with: { user: true },
    });
    if (primaryAdmin?.user) {
      primaryAdminMap.set(company.id, { name: userDisplayName(primaryAdmin.user) });
    }

    // Contractor counts
    const activeContractors = await db.query.companyContractors.findMany({
      where: and(eq(companyContractors.companyId, company.id), isNull(companyContractors.endedAt)),
      columns: { id: true, userId: true },
    });
    activeContractorCountMap.set(company.id, activeContractors.length);

    // Investor counts excluding active contractors
    const activeWorkerUserIds = new Set(activeContractors.map((c) => c.userId));
    const investors = await db.query.companyInvestors.findMany({
      where: eq(companyInvestors.companyId, company.id),
      columns: { id: true, userId: true },
    });
    const nonWorkerInvestors = investors.filter((i) => !activeWorkerUserIds.has(i.userId));
    investorCountMap.set(company.id, nonWorkerInvestors.length);
  }

  // Determine roles in current company
  let activeRole: "administrator" | "lawyer" | "contractorOrInvestor" = "contractorOrInvestor";
  const roles: CurrentUser["roles"] = {};

  if (selectedCompany) {
    const companyId = selectedCompany.id;
    const adminRecord = user.companyAdministrators.find((a) => a.companyId === companyId);
    const lawyerRecord = user.companyLawyers.find((l) => l.companyId === companyId);
    const contractorRecord = user.companyContractors.find((c) => c.companyId === companyId);
    const investorRecord = user.companyInvestors.find((i) => i.companyId === companyId);

    const availableRoles: AccessRole[] = [];
    if (contractorRecord) availableRoles.push("worker");
    if (adminRecord) availableRoles.push("administrator");
    if (lawyerRecord) availableRoles.push("lawyer");
    if (investorRecord) availableRoles.push("investor");

    const cookieRole = options.accessRoles?.[selectedCompany.externalId];
    let selectedAccessRole: AccessRole = availableRoles[0] ?? "worker";

    if (cookieRole && availableRoles.includes(cookieRole)) {
      selectedAccessRole = cookieRole;
    } else if (adminRecord && !contractorRecord && !investorRecord) {
      selectedAccessRole = "administrator";
    } else if (lawyerRecord && !contractorRecord && !investorRecord) {
      selectedAccessRole = "lawyer";
    } else if (contractorRecord) {
      selectedAccessRole = "worker";
    } else if (investorRecord) {
      selectedAccessRole = "investor";
    }

    if (selectedAccessRole === "administrator") activeRole = "administrator";
    else if (selectedAccessRole === "lawyer") activeRole = "lawyer";
    else activeRole = "contractorOrInvestor";

    if (adminRecord) {
      let isInvited = false;
      if (user.invitedById) {
        const inviterContractor = await db.query.companyContractors.findFirst({
          where: and(eq(companyContractors.userId, user.invitedById), eq(companyContractors.companyId, companyId)),
        });
        isInvited = !!inviterContractor;
      }
      roles.administrator = {
        id: String(adminRecord.id),
        isInvited,
      };
    }

    if (lawyerRecord) {
      roles.lawyer = {
        id: lawyerRecord.externalId,
      };
    }

    if (investorRecord) {
      const hasGrants =
        (await db.query.equityGrants.findFirst({
          where: and(
            eq(equityGrants.companyInvestorId, investorRecord.id),
            isNotNull(equityGrants.acceptedAt),
            or(
              eq(equityGrants.exercisedShares, 0),
              ne(equityGrants.vestedShares, 0),
              ne(equityGrants.unvestedShares, 0),
            ),
          ),
        })) != null;

      const hasShares =
        (await db.query.shareHoldings.findFirst({
          where: eq(shareHoldings.companyInvestorId, investorRecord.id),
        })) != null;

      const hasConvertibles =
        (await db.query.convertibleSecurities.findFirst({
          where: eq(convertibleSecurities.companyInvestorId, investorRecord.id),
        })) != null;

      roles.investor = {
        id: investorRecord.externalId,
        hasDocuments,
        hasGrants,
        hasShares,
        hasConvertibles,
        investedInAngelListRuv: Boolean(investorRecord.investedInAngelListRuv),
      };
    }

    if (contractorRecord) {
      const payRateType =
        contractorRecord.payRateType === 1 ? "project_based" : contractorRecord.payRateType === 2 ? "salary" : "hourly";

      roles.worker = {
        id: contractorRecord.externalId,
        hasDocuments,
        endedAt: contractorRecord.endedAt ? contractorRecord.endedAt.toISOString() : null,
        payRateType,
        inviting_company: Boolean(user.invitingCompany),
        role: contractorRecord.role
          ? {
              name: contractorRecord.role.name,
              expenseCardEnabled: Boolean(contractorRecord.role.expenseCardEnabled),
            }
          : { name: "Contractor", expenseCardEnabled: false },
        onTrial: Boolean(contractorRecord.onTrial),
        hoursPerWeek: contractorRecord.hoursPerWeek != null ? Number(contractorRecord.hoursPerWeek) : null,
        payRateInSubunits:
          contractorRecord.payRateInSubunits != null ? Number(contractorRecord.payRateInSubunits) : null,
      };
    }
  }

  // Calculate onboarding path
  let onboardingPath: string | null = null;
  const userBirthDate = complianceInfo?.birthDate ?? user.birthDate;
  const userCitizenshipCountryCode = complianceInfo?.citizenshipCountryCode ?? user.citizenshipCountryCode;
  const userTaxId = complianceInfo?.taxId;
  const hasPersonalDetails = Boolean(user.legalName && user.preferredName && userCitizenshipCountryCode);
  const hasLegalDetails = Boolean(
    user.streetAddress && user.city && user.zipCode && (!isBusinessEntity || businessName),
  );
  const hasBankDetails = user.wiseRecipients.length > 0;
  const isSanctioned = isSanctionedCountry(user.countryCode);
  const requiresW9 = [userCitizenshipCountryCode, user.countryCode].includes("US");
  const hasTaxInfo = Boolean(userTaxId && (requiresW9 || userBirthDate));

  if (selectedCompany && user.companyAdministrators.some((a) => a.companyId === selectedCompany?.id)) {
    const hasCompanyDetails = Boolean(
      selectedCompany.name &&
        selectedCompany.streetAddress &&
        selectedCompany.city &&
        selectedCompany.state &&
        selectedCompany.zipCode,
    );
    const stripe = stripeAccountsMap.get(selectedCompany.id);
    const bankAccountAdded = Boolean(stripe && stripe.status !== "initial");

    if (!hasCompanyDetails) {
      onboardingPath = `/companies/${selectedCompany.externalId}/administrator/onboarding/details`;
    } else if (!bankAccountAdded) {
      onboardingPath = `/companies/${selectedCompany.externalId}/administrator/onboarding/bank_account`;
    }
  } else if (selectedCompany && user.companyLawyers.some((l) => l.companyId === selectedCompany?.id)) {
    onboardingPath = null;
  } else if (selectedCompany && user.companyContractors.some((c) => c.companyId === selectedCompany?.id)) {
    if (!hasPersonalDetails) {
      onboardingPath = `/companies/${selectedCompany.externalId}/worker/onboarding`;
    } else if (!hasLegalDetails) {
      onboardingPath = `/companies/${selectedCompany.externalId}/worker/onboarding/legal`;
    } else if (!hasBankDetails && !isSanctioned) {
      onboardingPath = `/companies/${selectedCompany.externalId}/worker/onboarding/bank_account`;
    }
  } else if (selectedCompany && user.companyInvestors.some((i) => i.companyId === selectedCompany?.id)) {
    if (!hasPersonalDetails) {
      onboardingPath = `/companies/${selectedCompany.externalId}/investor/onboarding`;
    } else if (!hasLegalDetails || !hasTaxInfo) {
      onboardingPath = `/companies/${selectedCompany.externalId}/investor/onboarding/legal`;
    } else if (!hasBankDetails && !isSanctioned) {
      onboardingPath = `/companies/${selectedCompany.externalId}/investor/onboarding/bank_account`;
    }
  } else if (user.invitingCompany) {
    if (!hasPersonalDetails) {
      onboardingPath = "/onboarding";
    } else if (!hasLegalDetails) {
      onboardingPath = "/onboarding/legal";
    } else if (!hasBankDetails && !isSanctioned) {
      onboardingPath = "/onboarding/bank_account";
    }
  } else if (allCompaniesList.length === 0) {
    onboardingPath = "/onboarding/type";
  }

  // Build companies array
  const displayedCompanies = user.invitingCompany ? [] : allCompaniesList;
  const companiesOutput: CurrentUser["companies"] = [];

  for (const company of displayedCompanies) {
    const isCompanyAdmin = user.companyAdministrators.some((a) => a.companyId === company.id);
    const isCompanyLawyer = user.companyLawyers.some((l) => l.companyId === company.id);
    const isCompanyContractor = user.companyContractors.some((c) => c.companyId === company.id);
    const isCompanyInvestor = user.companyInvestors.some((i) => i.companyId === company.id);
    const canViewFinancialData = isCompanyAdmin || isCompanyInvestor;

    const availableRoles: AccessRole[] = [];
    if (isCompanyContractor) availableRoles.push("worker");
    if (isCompanyAdmin) availableRoles.push("administrator");
    if (isCompanyLawyer) availableRoles.push("lawyer");
    if (isCompanyInvestor) availableRoles.push("investor");

    const cookieRole = options.accessRoles?.[company.externalId];
    let selectedAccessRole: AccessRole | null = availableRoles[0] ?? null;
    if (cookieRole && availableRoles.includes(cookieRole)) {
      selectedAccessRole = cookieRole;
    }

    const otherAccessRoles = availableRoles
      .filter((r) => r !== selectedAccessRole)
      .filter((r) => !(r === "investor" && availableRoles.includes("worker")));

    // Compute routes for company
    const routes: { label: string; name: string; subLinks?: { label: string; name: string }[] }[] = [];

    // 1. Updates
    const companyUpdatesAllowed =
      Boolean(company.companyUpdatesEnabled) && (isCompanyAdmin || isCompanyContractor || isCompanyInvestor);
    const contractor = user.companyContractors.find((c) => c.companyId === company.id);
    const teamUpdatesAllowed =
      Boolean(company.teamUpdatesEnabled) &&
      (isCompanyAdmin || Boolean(isCompanyContractor && (!contractor?.endedAt || contractor.endedAt > new Date())));

    if (companyUpdatesAllowed && teamUpdatesAllowed) {
      routes.push({
        label: "Updates",
        name: "company_updates_company_index",
        subLinks: [
          { label: "Company", name: "company_updates_company_index" },
          { label: "Team", name: "company_updates_team_index" },
        ],
      });
    } else if (teamUpdatesAllowed) {
      routes.push({ label: "Updates", name: "company_updates_team_index" });
    } else if (companyUpdatesAllowed) {
      routes.push({ label: "Updates", name: "company_updates_company_index" });
    }

    // 2. Invoices
    if (isCompanyContractor || isCompanyAdmin) {
      routes.push({ label: "Invoices", name: "company_invoices" });
    }

    // 3. Expenses
    if (company.expenseCardsEnabled && (isCompanyContractor || isCompanyAdmin)) {
      routes.push({ label: "Expenses", name: "company_expenses" });
    }

    // 4. Documents
    routes.push({ label: "Documents", name: "company_documents" });

    // 5. People
    if (isCompanyAdmin) {
      routes.push({ label: "People", name: "company_workers" });
    }

    // 6. Roles
    if (isCompanyAdmin) {
      routes.push({ label: "Roles", name: "company_roles" });
    }

    // 7. Equity
    let equityName: string | null = null;
    if (company.capTableEnabled) {
      equityName = "company_cap_table";
    } else if (company.financingRoundsEnabled && (isCompanyAdmin || isCompanyLawyer || isCompanyInvestor)) {
      equityName = "company_financing_rounds";
    } else if (isCompanyInvestor) {
      equityName = "company_dividends";
    } else if (company.equityGrantsEnabled && (isCompanyInvestor || isCompanyAdmin || isCompanyLawyer)) {
      equityName = "company_equity_grants";
    } else if (company.dividendsAllowed && (isCompanyAdmin || isCompanyLawyer)) {
      equityName = "company_dividend_rounds";
    }
    if (equityName) {
      routes.push({ label: "Equity", name: equityName });
    }

    // 8. Settings
    if (isCompanyAdmin || (allCompaniesList.length === 0 && !user.invitingCompany)) {
      routes.push({ label: "Settings", name: "company_administrator_settings" });
    } else if (company.equityCompensationEnabled && isCompanyContractor && contractor?.payRateType !== 2) {
      routes.push({ label: "Settings", name: "company_settings_equity" });
    }

    // Flags
    const rawFlags = new Set<string>();
    if (company.upcomingDividendCents != null && company.upcomingDividendCents > 0n) rawFlags.add("upcoming_dividend");
    if (company.irsTaxForms) rawFlags.add("irs_tax_forms");
    if (company.expenseCardsEnabled) {
      rawFlags.add("expense_cards");
      rawFlags.add("expenses");
    }
    if (company.companyUpdatesEnabled) rawFlags.add("company_updates");
    if (company.teamUpdatesEnabled) rawFlags.add("team_updates");
    if (company.equityCompensationEnabled) rawFlags.add("equity_compensation");
    if (company.equityGrantsEnabled) rawFlags.add("equity_grants");
    if (company.financingRoundsEnabled) rawFlags.add("financing_rounds");
    if (company.dividendsAllowed) rawFlags.add("dividends");
    if (company.tenderOffersEnabled) rawFlags.add("tender_offers");
    if (company.capTableEnabled) rawFlags.add("cap_table");
    if (company.lawyersEnabled) rawFlags.add("lawyers");
    for (const f of company.jsonData?.flags ?? []) rawFlags.add(f);

    const stripe = stripeAccountsMap.get(company.id);
    const bankAccountReady = Boolean(stripe && stripe.status === "ready");

    companiesOutput.push({
      id: company.externalId,
      name: company.name,
      logo_url: null,
      address: {
        street_address: company.streetAddress,
        city: company.city,
        state: company.state,
        zip_code: company.zipCode,
        country_code: company.countryCode,
        country: getCountryName(company.countryCode),
      },
      flags: Array.from(rawFlags),
      routes,
      selected_access_role: selectedAccessRole,
      other_access_roles: otherAccessRoles,
      requiredInvoiceApprovals: company.requiredInvoiceApprovalCount,
      completedPaymentMethodSetup: bankAccountReady,
      paymentProcessingDays: company.isTrusted ? 2 : 10,
      createdAt: company.createdAt.toISOString(),
      fullyDilutedShares:
        canViewFinancialData && company.fullyDilutedShares != null ? Number(company.fullyDilutedShares) : null,
      valuationInDollars:
        canViewFinancialData && company.valuationInDollars != null ? Number(company.valuationInDollars) : null,
      sharePriceInUsd: canViewFinancialData && company.sharePriceInUsd ? String(company.sharePriceInUsd) : null,
      conversionSharePriceUsd:
        canViewFinancialData && company.conversionSharePriceUsd ? String(company.conversionSharePriceUsd) : null,
      exercisePriceInUsd: canViewFinancialData && company.fmvPerShareInUsd ? String(company.fmvPerShareInUsd) : null,
      investorCount: isCompanyAdmin ? (investorCountMap.get(company.id) ?? 0) : null,
      contractorCount: isCompanyAdmin ? (activeContractorCountMap.get(company.id) ?? 0) : null,
      primaryAdminName: primaryAdminMap.get(company.id)?.name ?? null,
      isTrusted: Boolean(company.isTrusted),
      expenseCardsEnabled: Boolean(company.expenseCardsEnabled),
    });
  }

  const result = {
    id: user.externalId,
    name: userDisplayName(user),
    address: {
      street_address: user.streetAddress,
      city: user.city,
      state: user.state,
      zip_code: user.zipCode,
      country_code: user.countryCode,
      country: getCountryName(user.countryCode),
    },
    currentCompanyId: selectedCompany?.externalId ?? null,
    onboardingPath,
    companies: companiesOutput,
    email: userDisplayEmail(user),
    preferredName: user.preferredName,
    legalName: user.legalName,
    billingEntityName,
    roles,
    activeRole,
  };

  return currentUserSchema.parse(result);
}

export async function getCurrentUserDataFromRequest(req: Request): Promise<CurrentUser | null> {
  const ipAddress = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const userId = await resolveClerkUserId(ipAddress);
  if (!userId) return null;

  const cookieHeader = req.headers.get("cookie") ?? "";
  let selectedCompanyId: string | null = null;
  const accessRoles: Record<string, AccessRole> = {};

  try {
    const cookiesObj = await getCookies();
    const userRow = await db.query.users.findFirst({
      where: eq(users.id, BigInt(userId)),
      columns: { externalId: true },
    });
    if (userRow) {
      selectedCompanyId = cookiesObj.get(`${userRow.externalId}_selected_company`)?.value ?? null;
      const rolesCookie = cookiesObj.get(`${userRow.externalId}_access_roles`)?.value;
      if (rolesCookie) {
        Object.assign(accessRoles, JSON.parse(rolesCookie));
      }
    }
  } catch {
    // If next/headers is unavailable or throws, parse header cookies manually
    const matchSelected = cookieHeader.match(/_selected_company=([^;]+)/u);
    if (matchSelected?.[1]) selectedCompanyId = matchSelected[1];
  }

  return getCurrentUserData(userId, { selectedCompanyId, accessRoles });
}
