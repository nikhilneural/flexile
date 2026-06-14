"use client";
/**
 * Compatibility layer that provides the same API surface as the old tRPC client
 * but routes all calls through the REST API client.
 *
 * This allows pages to use `trpc.X.Y.useSuspenseQuery(...)` syntax while the
 * underlying transport uses the new Hono REST API.
 */
import {
  useSuspenseQuery,
  useQuery,
  useMutation,
  useQueryClient,
  type UseSuspenseQueryResult,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import { apiClient } from "@/src/lib/api-client";

export { useCanAccess } from "@/providers";
export { DocumentTemplateType, DocumentType, PayRateType } from "@/db/enums";

type QueryHook<TData> = {
  useQuery: (
    input: Record<string, unknown>,
    options?: { enabled?: boolean; staleTime?: number; refetchInterval?: number | false },
  ) => UseQueryResult<TData, Error>;
  useSuspenseQuery: (input: Record<string, unknown>) => [TData, UseSuspenseQueryResult<TData, Error>];
};

type MutationHook<TData, TInput> = {
  useMutation: (options?: {
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
  }) => UseMutationResult<TData, Error, TInput>;
};

function createQueryHook<TData>(
  path: string,
  queryKeyPrefix: string[],
): QueryHook<TData> {
  return {
    useQuery: (input, options) => {
      const params = input as Record<string, string | number | boolean | null | undefined>;
      return useQuery<TData, Error>({
        queryKey: [...queryKeyPrefix, input],
        queryFn: ({ signal }) => apiClient.get<TData>(path, params, signal),
        enabled: options?.enabled,
        staleTime: options?.staleTime,
        refetchInterval: options?.refetchInterval,
      });
    },
    useSuspenseQuery: (input) => {
      const params = input as Record<string, string | number | boolean | null | undefined>;
      const result = useSuspenseQuery<TData, Error>({
        queryKey: [...queryKeyPrefix, input],
        queryFn: ({ signal }) => apiClient.get<TData>(path, params, signal),
      });
      return [result.data, result];
    },
  };
}

function createMutationHook<TData, TInput>(
  method: "post" | "put" | "patch" | "delete",
  path: string | ((input: TInput) => string),
): MutationHook<TData, TInput> {
  return {
    useMutation: (options) => {
      return useMutation<TData, Error, TInput>({
        mutationFn: (variables) => {
          const resolvedPath = typeof path === "function" ? path(variables) : path;
          return apiClient[method]<TData>(resolvedPath, variables);
        },
        ...options,
      });
    },
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const trpc = {
  useUtils: () => {
    const queryClient = useQueryClient();
    return new Proxy({} as any, {
      get: (_target, domain: string) =>
        new Proxy({} as any, {
          get: (_t2, method: string) => ({
            invalidate: (params?: any) =>
              queryClient.invalidateQueries({ queryKey: [domain, method, ...(params ? [params] : [])] }),
            refetch: (params?: any) =>
              queryClient.refetchQueries({ queryKey: [domain, method, ...(params ? [params] : [])] }),
          }),
        }),
    });
  },

  invoices: {
    list: createQueryHook<any>("/api/invoices", ["invoices", "list"]),
    get: createQueryHook<any>("/api/invoices/get", ["invoices", "get"]),
    create: createMutationHook<any, any>("post", "/api/invoices"),
    createAsAdmin: createMutationHook<any, any>("post", "/api/invoices/admin"),
    update: createMutationHook<any, any>("put", (input: any) => `/api/invoices/${input.id}`),
    approve: createMutationHook<any, any>("post", "/api/invoices/approve"),
    reject: createMutationHook<any, any>("post", "/api/invoices/reject"),
    delete: createMutationHook<any, any>("delete", (input: any) => `/api/invoices/${input.id}`),
    acceptPayment: createMutationHook<any, any>("post", (input: any) => `/api/invoices/${input.id}/accept-payment`),
  },

  consolidatedInvoices: {
    list: createQueryHook<any>("/api/consolidated-invoices", ["consolidatedInvoices", "list"]),
    last: createQueryHook<any>("/api/consolidated-invoices/last", ["consolidatedInvoices", "last"]),
  },

  contractors: {
    list: createQueryHook<any>("/api/contractors", ["contractors", "list"]),
    listForTeamUpdates: createQueryHook<any>("/api/contractors/for-team-updates", ["contractors", "listForTeamUpdates"]),
    get: createQueryHook<any>("/api/contractors/get", ["contractors", "get"]),
    create: createMutationHook<any, any>("post", "/api/contractors"),
    update: createMutationHook<any, any>("put", (input: any) => `/api/contractors/${input.id}`),
    endContract: createMutationHook<any, any>("post", (input: any) => `/api/contractors/${input.id}/end-contract`),
    cancelContractEnd: createMutationHook<any, any>("post", (input: any) => `/api/contractors/${input.id}/cancel-end`),
    completeTrial: createMutationHook<any, any>("post", (input: any) => `/api/contractors/${input.id}/complete-trial`),
  },

  contractorProfiles: {
    list: createQueryHook<any>("/api/contractor-profiles", ["contractorProfiles", "list"]),
    get: createQueryHook<any>("/api/contractor-profiles/get", ["contractorProfiles", "get"]),
  },

  equityGrants: {
    list: createQueryHook<any>("/api/equity-grants", ["equityGrants", "list"]),
    get: createQueryHook<any>("/api/equity-grants/get", ["equityGrants", "get"]),
    new: createQueryHook<any>("/api/equity-grants/new", ["equityGrants", "new"]),
    totals: createQueryHook<any>("/api/equity-grants/totals", ["equityGrants", "totals"]),
    byCountry: createQueryHook<any>("/api/equity-grants/by-country", ["equityGrants", "byCountry"]),
    getUniqueUnvested: createQueryHook<any>("/api/equity-grants/unique-unvested", ["equityGrants", "getUniqueUnvested"]),
    sumVestedShares: createQueryHook<any>("/api/equity-grants/sum-vested-shares", ["equityGrants", "sumVestedShares"]),
    create: createMutationHook<any, any>("post", "/api/equity-grants"),
    update: createMutationHook<any, any>("put", (input: any) => `/api/equity-grants/${input.id}`),
    exercise: createMutationHook<any, any>("post", "/api/equity-grants/exercise"),
  },

  equityCalculations: {
    calculate: createQueryHook<any>("/api/equity-calculations", ["equityCalculations", "calculate"]),
  },

  equityAllocations: {
    forYear: createQueryHook<any>("/api/equity-allocations/for-year", ["equityAllocations", "forYear"]),
    update: createMutationHook<any, any>("put", "/api/equity-allocations"),
    lock: createMutationHook<any, any>("post", "/api/equity-allocations/lock"),
  },

  equitySettings: {
    get: createQueryHook<any>("/api/equity-settings", ["equitySettings", "get"]),
    update: createMutationHook<any, any>("put", "/api/equity-settings"),
  },

  equityGrantExercises: {
    list: createQueryHook<any>("/api/equity-grant-exercises", ["equityGrantExercises", "list"]),
    create: createMutationHook<any, any>("post", "/api/equity-grant-exercises"),
  },

  shareHoldings: {
    list: createQueryHook<any>("/api/share-holdings", ["shareHoldings", "list"]),
    sumByShareClass: createQueryHook<any>("/api/share-holdings/sum-by-share-class", ["shareHoldings", "sumByShareClass"]),
    create: createMutationHook<any, any>("post", "/api/share-holdings"),
  },

  dividends: {
    list: createQueryHook<any>("/api/dividends", ["dividends", "list"]),
  },

  dividendRounds: {
    list: createQueryHook<any>("/api/dividend-rounds", ["dividendRounds", "list"]),
    get: createQueryHook<any>("/api/dividend-rounds/get", ["dividendRounds", "get"]),
    create: createMutationHook<any, any>("post", "/api/dividend-rounds"),
  },

  capTable: {
    show: createQueryHook<any>("/api/cap-table", ["capTable", "show"]),
  },

  capTableUploads: {
    list: createQueryHook<any>("/api/cap-table-uploads", ["capTableUploads", "list"]),
    canCreate: createQueryHook<any>("/api/cap-table-uploads/can-create", ["capTableUploads", "canCreate"]),
    create: createMutationHook<any, any>("post", "/api/cap-table-uploads"),
    process: createMutationHook<any, any>("post", (input: any) => `/api/cap-table-uploads/${input.id}/process`),
  },

  convertibleSecurities: {
    list: createQueryHook<any>("/api/convertible-securities", ["convertibleSecurities", "list"]),
    create: createMutationHook<any, any>("post", "/api/convertible-securities"),
  },

  financingRounds: {
    list: createQueryHook<any>("/api/financing-rounds", ["financingRounds", "list"]),
    create: createMutationHook<any, any>("post", "/api/financing-rounds"),
    update: createMutationHook<any, any>("put", (input: any) => `/api/financing-rounds/${input.id}`),
  },

  optionPools: {
    list: createQueryHook<any>("/api/option-pools", ["optionPools", "list"]),
    create: createMutationHook<any, any>("post", "/api/option-pools"),
  },

  tenderOffers: {
    list: createQueryHook<any>("/api/tender-offers", ["tenderOffers", "list"]),
    get: createQueryHook<any>("/api/tender-offers/get", ["tenderOffers", "get"]),
    create: createMutationHook<any, any>("post", "/api/tender-offers"),
    update: createMutationHook<any, any>("put", (input: any) => `/api/tender-offers/${input.id}`),
    bids: {
      list: createQueryHook<any>("/api/tender-offers/bids", ["tenderOffers", "bids", "list"]),
      create: createMutationHook<any, any>("post", "/api/tender-offers/bids"),
      destroy: createMutationHook<any, any>("delete", (input: any) => `/api/tender-offers/bids/${input.id}`),
    },
  },

  documents: {
    list: createQueryHook<any>("/api/documents", ["documents", "list"]),
    get: createQueryHook<any>("/api/documents/get", ["documents", "get"]),
    getUrl: createQueryHook<any>("/api/documents/url", ["documents", "getUrl"]),
    years: createQueryHook<any>("/api/documents/years", ["documents", "years"]),
    sign: createMutationHook<any, any>("post", "/api/documents/sign"),
    create: createMutationHook<any, any>("post", "/api/documents"),
    templates: {
      list: createQueryHook<any>("/api/document-templates", ["documents", "templates", "list"]),
      get: createQueryHook<any>("/api/document-templates/get", ["documents", "templates", "get"]),
      getSubmitterSlug: createQueryHook<any>("/api/document-templates/submitter-slug", ["documents", "templates", "getSubmitterSlug"]),
      create: createMutationHook<any, any>("post", "/api/document-templates"),
      update: createMutationHook<any, any>("put", (input: any) => `/api/document-templates/${input.id}`),
      delete: createMutationHook<any, any>("delete", (input: any) => `/api/document-templates/${input.id}`),
    },
  },

  roles: {
    list: createQueryHook<any>("/api/roles", ["roles", "list"]),
    get: createQueryHook<any>("/api/roles/get", ["roles", "get"]),
    create: createMutationHook<any, any>("post", "/api/roles"),
    update: createMutationHook<any, any>("put", (input: any) => `/api/roles/${input.id}`),
    delete: createMutationHook<any, any>("delete", (input: any) => `/api/roles/${input.id}`),
    public: {
      list: createQueryHook<any>("/api/roles/public", ["roles", "public", "list"]),
      get: createQueryHook<any>("/api/roles/public/get", ["roles", "public", "get"]),
    },
    applications: {
      list: createQueryHook<any>("/api/role-applications", ["roles", "applications", "list"]),
      get: createQueryHook<any>("/api/role-applications/get", ["roles", "applications", "get"]),
      create: createMutationHook<any, any>("post", "/api/role-applications"),
      reject: createMutationHook<any, any>("post", (input: any) => `/api/role-applications/${input.id}/reject`),
    },
  },

  companyUpdates: {
    list: createQueryHook<any>("/api/company-updates", ["companyUpdates", "list"]),
    get: createQueryHook<any>("/api/company-updates/get", ["companyUpdates", "get"]),
    create: createMutationHook<any, any>("post", "/api/company-updates"),
    update: createMutationHook<any, any>("put", (input: any) => `/api/company-updates/${input.id}`),
    delete: createMutationHook<any, any>("delete", (input: any) => `/api/company-updates/${input.id}`),
    publish: createMutationHook<any, any>("post", (input: any) => `/api/company-updates/${input.id}/publish`),
    sendTestEmail: createMutationHook<any, any>("post", (input: any) => `/api/company-updates/${input.id}/send-test-email`),
  },

  teamUpdates: {
    list: createQueryHook<any>("/api/team-updates", ["teamUpdates", "list"]),
    get: createQueryHook<any>("/api/team-updates/get", ["teamUpdates", "get"]),
    set: createMutationHook<any, any>("post", "/api/team-updates"),
  },

  teamUpdateTasks: {
    list: createQueryHook<any>("/api/team-update-tasks", ["teamUpdateTasks", "list"]),
    listForInvoice: createQueryHook<any>("/api/team-update-tasks/for-invoice", ["teamUpdateTasks", "listForInvoice"]),
    create: createMutationHook<any, any>("post", "/api/team-update-tasks"),
    update: createMutationHook<any, any>("put", (input: any) => `/api/team-update-tasks/${input.id}`),
    delete: createMutationHook<any, any>("delete", (input: any) => `/api/team-update-tasks/${input.id}`),
  },

  companies: {
    list: createQueryHook<any>("/api/companies", ["companies", "list"]),
    get: createQueryHook<any>("/api/companies/get", ["companies", "get"]),
    settings: createQueryHook<any>("/api/companies/settings", ["companies", "settings"]),
    publicInfo: createQueryHook<any>("/api/companies/public-info", ["companies", "publicInfo"]),
    create: createMutationHook<any, any>("post", "/api/companies"),
    update: createMutationHook<any, any>("put", (input: any) => `/api/companies/${input.id}`),
    invite: createMutationHook<any, any>("post", "/api/companies/invite"),
    microdepositVerificationDetails: createQueryHook<any>("/api/companies/microdeposit-verification-details", ["companies", "microdepositVerificationDetails"]),
    microdepositVerification: createMutationHook<any, any>("post", "/api/companies/microdeposit-verification"),
  },

  companyAdministrators: {
    list: createQueryHook<any>("/api/company-administrators", ["companyAdministrators", "list"]),
    update: createMutationHook<any, any>("put", (input: any) => `/api/company-administrators/${input.id}`),
  },

  users: {
    get: createQueryHook<any>("/api/users/get", ["users", "get"]),
    update: createMutationHook<any, any>("put", (input: any) => `/api/users/${input.id}`),
    updateTaxSettings: createMutationHook<any, any>("put", "/api/users/tax-settings"),
    switchCompany: createMutationHook<any, any>("post", "/api/users/switch-company"),
  },

  expenses: {
    list: createQueryHook<any>("/api/expenses", ["expenses", "list"]),
    create: createMutationHook<any, any>("post", "/api/expenses"),
    update: createMutationHook<any, any>("put", (input: any) => `/api/expenses/${input.id}`),
    delete: createMutationHook<any, any>("delete", (input: any) => `/api/expenses/${input.id}`),
  },

  expenseCards: {
    getActive: createQueryHook<any>("/api/expense-cards/active", ["expenseCards", "getActive"]),
    create: createMutationHook<any, any>("post", "/api/expense-cards"),
    createStripeEphemeralKey: createMutationHook<any, any>("post", "/api/expense-cards/stripe-ephemeral-key"),
    charges: {
      list: createQueryHook<any>("/api/expense-cards/charges", ["expenseCards", "charges", "list"]),
    },
  },

  expenseCategories: {
    list: createQueryHook<any>("/api/expense-categories", ["expenseCategories", "list"]),
    update: createMutationHook<any, any>("put", (input: any) => `/api/expense-categories/${input.id}`),
  },

  investorEntities: {
    list: createQueryHook<any>("/api/investor-entities", ["investorEntities", "list"]),
    get: createQueryHook<any>("/api/investor-entities/get", ["investorEntities", "get"]),
    create: createMutationHook<any, any>("post", "/api/investor-entities"),
    update: createMutationHook<any, any>("put", (input: any) => `/api/investor-entities/${input.id}`),
  },

  investors: {
    get: createQueryHook<any>("/api/investors/get", ["investors", "get"]),
  },

  lawyers: {
    invite: createMutationHook<any, any>("post", "/api/lawyers/invite"),
  },

  github: {
    get: createQueryHook<any>("/api/github", ["github", "get"]),
    search: createQueryHook<any>("/api/github/search", ["github", "search"]),
    connect: createMutationHook<any, any>("post", "/api/github/connect"),
    disconnect: createMutationHook<any, any>("post", "/api/github/disconnect"),
  },

  quickbooks: {
    get: createQueryHook<any>("/api/quickbooks", ["quickbooks", "get"]),
    connect: createMutationHook<any, any>("post", "/api/quickbooks/connect"),
    disconnect: createMutationHook<any, any>("post", "/api/quickbooks/disconnect"),
    updateConfiguration: createMutationHook<any, any>("put", "/api/quickbooks/configuration"),
  },

  stripe: {
    setupIntent: createMutationHook<any, any>("post", "/api/stripe/setup-intent"),
    verifyMicrodeposit: createMutationHook<any, any>("post", "/api/stripe/verify-microdeposit"),
  },

  files: {
    createDirectUploadUrl: createMutationHook<any, any>("post", "/api/files/direct-upload-url"),
  },

  financialReports: {
    get: createQueryHook<any>("/api/financial-reports", ["financialReports", "get"]),
  },

  wallets: {
    update: createMutationHook<any, any>("put", "/api/wallets"),
  },

  workerAbsences: {
    list: createQueryHook<any>("/api/worker-absences", ["workerAbsences", "list"]),
    create: createMutationHook<any, any>("post", "/api/worker-absences"),
    update: createMutationHook<any, any>("put", (input: any) => `/api/worker-absences/${input.id}`),
    delete: createMutationHook<any, any>("delete", (input: any) => `/api/worker-absences/${input.id}`),
  },

  talentPool: {
    list: createQueryHook<any>("/api/talent-pool", ["talentPool", "list"]),
    get: createQueryHook<any>("/api/talent-pool/get", ["talentPool", "get"]),
  },

  billing: {
    get: createQueryHook<any>("/api/billing", ["billing", "get"]),
    update: createMutationHook<any, any>("put", "/api/billing"),
    createPortalSession: createMutationHook<any, any>("post", "/api/billing/portal-session"),
  },

  payoutSettings: {
    get: createQueryHook<any>("/api/payout-settings", ["payoutSettings", "get"]),
    update: createMutationHook<any, any>("put", "/api/payout-settings"),
  },

  taxSettings: {
    get: createQueryHook<any>("/api/tax-settings", ["taxSettings", "get"]),
    update: createMutationHook<any, any>("put", "/api/tax-settings"),
  },

  onboarding: {
    get: createQueryHook<any>("/api/onboarding", ["onboarding", "get"]),
    update: createMutationHook<any, any>("put", "/api/onboarding"),
  },

  adminSettings: {
    get: createQueryHook<any>("/api/admin/settings", ["adminSettings", "get"]),
    update: createMutationHook<any, any>("put", "/api/admin/settings"),
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */
