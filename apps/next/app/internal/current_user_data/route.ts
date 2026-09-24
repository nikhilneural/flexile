import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { type CurrentUser, currentUserSchema } from "@/models/user";
import { getCurrentUserDataFromRequest } from "@/trpc/routes/users/currentUserData";

function getDemoCurrentUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  const demo: CurrentUser = {
    id: overrides.id || "1",
    name: overrides.name || "Demo User",
    email: overrides.email || "demo@fillanadpay.com",
    preferredName: overrides.preferredName || "Demo",
    legalName: overrides.legalName || "Demo User",
    billingEntityName: overrides.billingEntityName || "FillanadPay Demo LLC",
    currentCompanyId: "1",
    onboardingPath: null,
    address: {
      street_address: "123 Market St",
      city: "San Francisco",
      state: "CA",
      zip_code: "94105",
      country: "United States",
      country_code: "US",
    },
    companies: [
      {
        id: "1",
        name: "FillanadPay Inc.",
        logo_url: null,
        address: {
          street_address: "123 Market St",
          city: "San Francisco",
          state: "CA",
          zip_code: "94105",
          country: "United States",
          country_code: "US",
        },
        flags: [
          "upcoming_dividend",
          "irs_tax_forms",
          "expense_cards",
          "company_updates",
          "salary_roles",
          "team_updates",
          "equity_compensation",
          "equity_grants",
          "financing_rounds",
          "dividends",
          "cap_table",
          "lawyers",
          "expenses",
        ],
        routes: [
          {
            label: "Updates",
            name: "company_updates_company_index",
            subLinks: [
              { label: "Company", name: "company_updates_company_index" },
              { label: "Team", name: "company_updates_team_index" },
            ],
          },
          { label: "Invoices", name: "company_invoices" },
          { label: "Expenses", name: "company_expenses" },
          { label: "Documents", name: "company_documents" },
          { label: "People", name: "company_workers" },
          { label: "Roles", name: "company_roles" },
          { label: "Equity", name: "company_cap_table" },
          { label: "Settings", name: "company_administrator_settings" },
        ],
        selected_access_role: "administrator",
        other_access_roles: ["worker"],
        requiredInvoiceApprovals: 1,
        completedPaymentMethodSetup: true,
        paymentProcessingDays: 2,
        createdAt: "2024-01-01T00:00:00.000Z",
        fullyDilutedShares: 10000000,
        valuationInDollars: 50000000,
        sharePriceInUsd: "5.00",
        conversionSharePriceUsd: "5.00",
        exercisePriceInUsd: "1.00",
        contractorCount: 8,
        investorCount: 4,
        primaryAdminName: "Demo User",
        isTrusted: true,
        expenseCardsEnabled: true,
      },
    ],
    roles: {
      administrator: {
        id: "1",
        isInvited: false,
      },
      worker: {
        id: "1",
        hasDocuments: true,
        endedAt: null,
        payRateType: "hourly",
        inviting_company: false,
        role: {
          name: "Full Stack Engineer",
          expenseCardEnabled: true,
        },
        onTrial: false,
        hoursPerWeek: 40,
        payRateInSubunits: 10000,
      },
    },
    activeRole: "administrator",
    ...overrides,
  };

  return currentUserSchema.parse(demo);
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUserDataFromRequest(req);
    if (user) {
      return NextResponse.json(user);
    }
  } catch {
    // Database or context resolution failed, fallback to Clerk or demo
  }

  // Check if user is signed into Clerk
  try {
    const { userId: clerkUserId } = await auth();
    if (clerkUserId) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(clerkUserId);
        const email =
          clerkUser.emailAddresses.find((a) => a.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
          clerkUser.emailAddresses[0]?.emailAddress ??
          "demo@fillanadpay.com";
        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "Demo User";
        return NextResponse.json(
          getDemoCurrentUser({
            id: clerkUserId,
            email,
            name,
            preferredName: clerkUser.firstName || "Demo",
            legalName: name,
          }),
        );
      } catch {
        return NextResponse.json(getDemoCurrentUser({ id: clerkUserId }));
      }
    }
  } catch {
    // Clerk session read failed
  }

  // If in development or explicit demo requested, return demo user
  const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development";
  const wantsDemo = req.headers.get("x-demo-user") === "true";
  if (isDev && wantsDemo) {
    return NextResponse.json(getDemoCurrentUser());
  }

  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}
